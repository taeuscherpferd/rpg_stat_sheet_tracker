import { randomUUID } from 'node:crypto'
import type { SQLOutputValue, StatementResultingChanges } from 'node:sqlite'
import type { FocusSettings, XpEntryResponse } from '@rlrpg/shared/contracts'
import type { z } from 'zod'
import {
  entryUpdateSchema,
  focusSessionSchema,
  skillInputSchema,
} from '@rlrpg/shared/contracts'
import { AppDatabase } from './database.js'
import { FocusLogic } from './Focus.logic.js'
import { ProgressionLogic } from './Progression.logic.js'

type SkillInput = z.infer<typeof skillInputSchema>
type EntryUpdate = z.infer<typeof entryUpdateSchema>
type FocusInput = z.infer<typeof focusSessionSchema>

interface OwnedSkillRow {
  id: string
  archived_at: string | null
}

interface LinkSnapshotRow {
  skill_id: string
  percentage: number | null
  kind: 'direct' | 'linked'
}

type SqlRow<Row> = Row & Record<string, SQLOutputValue>

export class DomainError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = 'INVALID_REQUEST',
  ) {
    super(message)
  }
}

export class LedgerService {
  constructor(private readonly database: AppDatabase) {}

  createSkill(userId: string, input: SkillInput): string {
    const id = randomUUID()
    this.writeSkill(id, userId, input, false)
    return id
  }

  updateSkill(userId: string, skillId: string, input: SkillInput): void {
    this.requireSkill(userId, skillId, true)
    this.writeSkill(skillId, userId, input, true)
  }

  setArchived(userId: string, skillId: string, archived: boolean): void {
    this.requireSkill(userId, skillId, true)
    this.database.connection
      .prepare('UPDATE skills SET archived_at = ?, updated_at = ? WHERE id = ?')
      .run(
        archived ? new Date().toISOString() : null,
        new Date().toISOString(),
        skillId,
      )
  }

  createEntry(
    userId: string,
    input: EntryUpdate & { skillId: string },
    source: 'manual' | 'automation',
    origin: string | null,
  ): XpEntryResponse {
    this.requireSkill(userId, input.skillId, false)
    const entryId = randomUUID()
    this.database.transaction(() => {
      this.insertEntry(entryId, userId, input, source, origin)
      this.insertAwards(entryId, input.skillId, input.xp)
    })
    return this.requireEntry(userId, entryId)
  }

  updateEntry(
    userId: string,
    entryId: string,
    input: EntryUpdate,
  ): XpEntryResponse {
    const entry = this.requireEntry(userId, entryId)
    if (entry.source === 'focus') {
      throw new DomainError(
        'Focused Practice entries cannot be edited',
        409,
        'ENTRY_LOCKED',
      )
    }
    const snapshots = this.database.connection
      .prepare(
        'SELECT skill_id, percentage, kind FROM xp_awards WHERE entry_id = ?',
      )
      .all(entryId) as SqlRow<LinkSnapshotRow>[]
    const now = new Date().toISOString()
    this.database.transaction(() => {
      this.database.connection
        .prepare(
          `
        UPDATE xp_entries SET date = ?, xp = ?, minutes = ?, activity = ?, notes = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `,
        )
        .run(
          input.date,
          input.xp,
          input.minutes ?? null,
          input.activity ?? null,
          input.notes ?? null,
          now,
          entryId,
          userId,
        )
      this.database.connection
        .prepare('DELETE FROM xp_awards WHERE entry_id = ?')
        .run(entryId)
      for (const snapshot of snapshots) {
        const amount =
          snapshot.kind === 'direct'
            ? input.xp
            : Math.floor((input.xp * (snapshot.percentage ?? 0)) / 100)
        this.insertAward(
          entryId,
          snapshot.skill_id,
          amount,
          snapshot.kind,
          snapshot.percentage,
        )
      }
    })
    return this.requireEntry(userId, entryId)
  }

  deleteEntry(userId: string, entryId: string): void {
    this.requireEntry(userId, entryId)
    this.database.connection
      .prepare('DELETE FROM xp_entries WHERE id = ? AND user_id = ?')
      .run(entryId, userId)
  }

  createFocusEntry(
    userId: string,
    input: FocusInput,
    settings: FocusSettings,
  ): XpEntryResponse {
    this.requireSkill(userId, input.skillId, false)
    const intervals = FocusLogic.completedIntervals(
      input.focusedSeconds,
      settings.intervalMinutes,
    )
    if (intervals < 1 || input.rolls.length !== intervals) {
      throw new DomainError(
        `Expected ${intervals} d20 roll${intervals === 1 ? '' : 's'}`,
        400,
        'ROLL_COUNT_MISMATCH',
      )
    }
    const xp = FocusLogic.totalXp(input.rolls, settings)
    const entryId = randomUUID()
    const entryInput = {
      skillId: input.skillId,
      date: input.date,
      xp,
      minutes: Math.floor(input.focusedSeconds / 60),
      activity: 'Focused Practice',
      notes: input.notes ?? null,
    }
    this.database.transaction(() => {
      this.insertEntry(entryId, userId, entryInput, 'focus', null)
      this.insertAwards(entryId, input.skillId, xp)
      input.rolls.forEach((roll, position) => {
        this.database.connection
          .prepare(
            `
          INSERT INTO focus_rolls (id, entry_id, position, roll, awarded_xp) VALUES (?, ?, ?, ?, ?)
        `,
          )
          .run(
            randomUUID(),
            entryId,
            position,
            roll,
            FocusLogic.xpForRoll(roll, settings),
          )
      })
    })
    return this.requireEntry(userId, entryId)
  }

  updateSettings(userId: string, settings: FocusSettings): void {
    this.database.connection
      .prepare(
        `
      UPDATE focus_settings SET interval_minutes = ?, base_xp = ?, normal_percent = ?,
        natural_one_percent = ?, natural_twenty_percent = ? WHERE user_id = ?
    `,
      )
      .run(
        settings.intervalMinutes,
        settings.baseXp,
        settings.normalPercentPerPip,
        settings.naturalOneBonusPercent,
        settings.naturalTwentyBonusPercent,
        userId,
      )
  }

  private writeSkill(
    id: string,
    userId: string,
    input: SkillInput,
    updating: boolean,
  ): void {
    if (
      new Set(input.links.map((link) => link.targetSkillId)).size !==
      input.links.length
    ) {
      throw new DomainError('Linked skills must be unique')
    }
    if (input.links.some((link) => link.targetSkillId === id)) {
      throw new DomainError('A skill cannot link to itself')
    }
    for (const link of input.links)
      this.requireSkill(userId, link.targetSkillId, false)
    const now = new Date().toISOString()
    const transaction = () =>
      this.database.transaction(() => {
        if (updating) {
          this.database.connection
            .prepare(
              `
          UPDATE skills SET name = ?, code = ?, emoji = ?, tags = ?, header_color = ?,
            xp_bar_color = ?, updated_at = ? WHERE id = ? AND user_id = ?
        `,
            )
            .run(
              input.name,
              input.code,
              input.emoji ?? null,
              JSON.stringify(input.tags),
              input.headerColor,
              input.headerColor,
              now,
              id,
              userId,
            )
          this.database.connection
            .prepare('DELETE FROM skill_links WHERE source_skill_id = ?')
            .run(id)
        } else {
          this.database.connection
            .prepare(
              `
          INSERT INTO skills
            (id, user_id, name, code, emoji, tags, header_color, xp_bar_color, base_xp, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
            )
            .run(
              id,
              userId,
              input.name,
              input.code,
              input.emoji ?? null,
              JSON.stringify(input.tags),
              input.headerColor,
              input.headerColor,
              ProgressionLogic.totalXpForLevel(input.startingLevel ?? 1),
              now,
              now,
            )
        }
        for (const link of input.links) {
          this.database.connection
            .prepare(
              `
          INSERT INTO skill_links (source_skill_id, target_skill_id, percentage) VALUES (?, ?, ?)
        `,
            )
            .run(id, link.targetSkillId, link.percentage)
        }
      })
    try {
      transaction()
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE')) {
        throw new DomainError(
          'That three-character code is already in use',
          409,
          'CODE_EXISTS',
        )
      }
      throw error
    }
  }

  private requireSkill(
    userId: string,
    skillId: string,
    allowArchived: boolean,
  ): OwnedSkillRow {
    const skill = this.database.connection
      .prepare(
        'SELECT id, archived_at FROM skills WHERE id = ? AND user_id = ?',
      )
      .get(skillId, userId) as OwnedSkillRow | undefined
    if (skill === undefined)
      throw new DomainError('Skill not found', 404, 'SKILL_NOT_FOUND')
    if (!allowArchived && skill.archived_at !== null) {
      throw new DomainError(
        'Archived skills cannot receive XP',
        409,
        'SKILL_ARCHIVED',
      )
    }
    return skill
  }

  private requireEntry(userId: string, entryId: string): XpEntryResponse {
    const entry = this.database
      .listEntries(userId)
      .find((candidate) => candidate.id === entryId)
    if (entry === undefined)
      throw new DomainError('XP entry not found', 404, 'ENTRY_NOT_FOUND')
    return entry
  }

  private insertEntry(
    id: string,
    userId: string,
    input: EntryUpdate & { skillId: string },
    source: 'manual' | 'focus' | 'automation',
    origin: string | null,
  ): void {
    const now = new Date().toISOString()
    this.database.connection
      .prepare(
        `
      INSERT INTO xp_entries
        (id, user_id, skill_id, date, xp, minutes, activity, notes, source, origin, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        id,
        userId,
        input.skillId,
        input.date,
        input.xp,
        input.minutes ?? null,
        input.activity ?? null,
        input.notes ?? null,
        source,
        origin,
        now,
        now,
      )
  }

  private insertAwards(entryId: string, skillId: string, xp: number): void {
    this.insertAward(entryId, skillId, xp, 'direct', null)
    const links = this.database.connection
      .prepare(
        'SELECT target_skill_id, percentage FROM skill_links WHERE source_skill_id = ?',
      )
      .all(skillId) as SqlRow<{ target_skill_id: string; percentage: number }>[]
    for (const link of links) {
      this.insertAward(
        entryId,
        link.target_skill_id,
        Math.floor((xp * link.percentage) / 100),
        'linked',
        link.percentage,
      )
    }
  }

  private insertAward(
    entryId: string,
    skillId: string,
    amount: number,
    kind: 'direct' | 'linked',
    percentage: number | null,
  ): StatementResultingChanges {
    return this.database.connection
      .prepare(
        `
      INSERT INTO xp_awards (id, entry_id, skill_id, amount, kind, percentage) VALUES (?, ?, ?, ?, ?, ?)
    `,
      )
      .run(randomUUID(), entryId, skillId, amount, kind, percentage)
  }
}
