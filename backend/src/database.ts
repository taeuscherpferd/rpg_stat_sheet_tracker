import { DatabaseSync, type SQLOutputValue } from 'node:sqlite'
import type {
  AchievementResponse,
  AnkiSettings,
  ApiKeyResponse,
  FocusSettings,
  SkillResponse,
  XpAwardResponse,
  XpEntryResponse,
} from '@rlrpg/shared/contracts'
import {
  DEFAULT_MAXIMUM_MANUAL_XP,
  MAXIMUM_MANUAL_XP,
} from '@rlrpg/shared/rules'
import { ProgressionLogic } from './Progression.logic.js'

interface SkillRow {
  id: string
  name: string
  code: string
  emoji: string | null
  tags: string
  header_color: string
  archived_at: string | null
  total_xp: number
}

interface LinkRow {
  source_skill_id: string
  target_skill_id: string
  target_name: string
  percentage: number
}

interface EntryRow {
  id: string
  skill_id: string
  skill_name: string
  date: string
  xp: number
  minutes: number | null
  activity: string | null
  notes: string | null
  streak: number
  source: 'manual' | 'focus' | 'automation'
  origin: string | null
  created_at: string
  achievement_id: string | null
}

interface AwardRow {
  entry_id: string
  skill_id: string
  skill_name: string
  amount: number
  kind: 'direct' | 'linked'
  percentage: number | null
}

interface RollRow {
  entry_id: string
  roll: number
}

interface TableInfoRow {
  name: string
}

type SqlRow<Row> = Row & Record<string, SQLOutputValue>

export class AppDatabase {
  readonly connection: DatabaseSync

  constructor(filename: string) {
    this.connection = new DatabaseSync(filename, { timeout: 5000 })
    this.connection.exec('PRAGMA foreign_keys = ON')
    this.connection.exec('PRAGMA journal_mode = WAL')
    this.migrate()
  }

  close(): void {
    this.connection.close()
  }

  transaction<Result>(operation: () => Result): Result {
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      const result = operation()
      this.connection.exec('COMMIT')
      return result
    } catch (error) {
      this.connection.exec('ROLLBACK')
      throw error
    }
  }

  private migrate(): void {
    this.connection.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, username TEXT NOT NULL COLLATE NOCASE UNIQUE,
        password_hash TEXT NOT NULL, timezone TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL, code TEXT NOT NULL COLLATE NOCASE, emoji TEXT,
        base_xp INTEGER NOT NULL DEFAULT 0,
        tags TEXT NOT NULL DEFAULT '[]', header_color TEXT NOT NULL DEFAULT '#334b3f',
        xp_bar_color TEXT NOT NULL DEFAULT '#527260',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT,
        UNIQUE(user_id, code)
      );
      CREATE TABLE IF NOT EXISTS skill_links (
        source_skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
        target_skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
        percentage INTEGER NOT NULL CHECK(percentage BETWEEN 1 AND 30),
        PRIMARY KEY(source_skill_id, target_skill_id)
      );
      CREATE TABLE IF NOT EXISTS xp_entries (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE RESTRICT, date TEXT NOT NULL,
        xp INTEGER NOT NULL, minutes INTEGER, activity TEXT, notes TEXT,
        streak INTEGER NOT NULL DEFAULT 0,
        source TEXT NOT NULL CHECK(source IN ('manual','focus','automation')),
        origin TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS xp_awards (
        id TEXT PRIMARY KEY, entry_id TEXT NOT NULL REFERENCES xp_entries(id) ON DELETE CASCADE,
        skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
        amount INTEGER NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('direct','linked')),
        percentage INTEGER
      );
      CREATE TABLE IF NOT EXISTS focus_rolls (
        id TEXT PRIMARY KEY, entry_id TEXT NOT NULL REFERENCES xp_entries(id) ON DELETE CASCADE,
        position INTEGER NOT NULL, roll INTEGER NOT NULL CHECK(roll BETWEEN 1 AND 20),
        awarded_xp INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS focus_settings (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        interval_minutes INTEGER NOT NULL DEFAULT 25, base_xp INTEGER NOT NULL DEFAULT 100,
        normal_percent INTEGER NOT NULL DEFAULT 1, natural_one_percent INTEGER NOT NULL DEFAULT 0,
        natural_twenty_percent INTEGER NOT NULL DEFAULT 50,
        maximum_manual_xp INTEGER NOT NULL DEFAULT ${DEFAULT_MAXIMUM_MANUAL_XP}
      );
      CREATE TABLE IF NOT EXISTS anki_settings (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        new_card_xp INTEGER NOT NULL DEFAULT 1 CHECK(new_card_xp BETWEEN 0 AND ${MAXIMUM_MANUAL_XP}),
        review_xp INTEGER NOT NULL DEFAULT 1 CHECK(review_xp BETWEEN 0 AND ${MAXIMUM_MANUAL_XP})
      );
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL, prefix TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
        preset TEXT NOT NULL CHECK(preset IN ('reader','writer')),
        created_at TEXT NOT NULL, last_used_at TEXT, revoked_at TEXT
      );
      CREATE TABLE IF NOT EXISTS idempotency_records (
        api_key_id TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
        idempotency_key TEXT NOT NULL, payload_hash TEXT NOT NULL,
        entry_id TEXT NOT NULL REFERENCES xp_entries(id) ON DELETE CASCADE,
        PRIMARY KEY(api_key_id, idempotency_key)
      );
      CREATE INDEX IF NOT EXISTS idx_entries_user_date ON xp_entries(user_id, date DESC);
      CREATE INDEX IF NOT EXISTS idx_awards_skill ON xp_awards(skill_id);
    `)
    this.connection.exec(`
      CREATE TABLE IF NOT EXISTS achievements (
        id TEXT PRIMARY KEY, skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
        name TEXT NOT NULL, description TEXT NOT NULL, icon TEXT NOT NULL,
        xp INTEGER NOT NULL, bonus_award TEXT NOT NULL,
        earned_entry_id TEXT REFERENCES xp_entries(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_achievements_skill ON achievements(skill_id);
    `)
    this.connection.exec(`
      INSERT OR IGNORE INTO anki_settings (user_id, new_card_xp, review_xp)
      SELECT id, 1, 1 FROM users;
    `)
    const entryColumns = this.connection
      .prepare('PRAGMA table_info(xp_entries)')
      .all() as SqlRow<TableInfoRow>[]
    if (!entryColumns.some((column) => column.name === 'achievement_id')) {
      this.connection.exec(
        'ALTER TABLE xp_entries ADD COLUMN achievement_id TEXT',
      )
    }
    if (!entryColumns.some((column) => column.name === 'streak')) {
      this.connection.exec(
        'ALTER TABLE xp_entries ADD COLUMN streak INTEGER NOT NULL DEFAULT 0',
      )
    }
    const skillColumns = this.connection
      .prepare('PRAGMA table_info(skills)')
      .all() as SqlRow<TableInfoRow>[]
    if (!skillColumns.some((column) => column.name === 'base_xp')) {
      this.connection.exec(
        'ALTER TABLE skills ADD COLUMN base_xp INTEGER NOT NULL DEFAULT 0',
      )
    }
    if (!skillColumns.some((column) => column.name === 'tags')) {
      this.connection.exec(
        "ALTER TABLE skills ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'",
      )
    }
    if (!skillColumns.some((column) => column.name === 'header_color')) {
      this.connection.exec(
        "ALTER TABLE skills ADD COLUMN header_color TEXT NOT NULL DEFAULT '#334b3f'",
      )
    }
    if (!skillColumns.some((column) => column.name === 'xp_bar_color')) {
      this.connection.exec(
        "ALTER TABLE skills ADD COLUMN xp_bar_color TEXT NOT NULL DEFAULT '#527260'",
      )
    }
    this.connection.exec(
      'UPDATE skills SET xp_bar_color = header_color WHERE xp_bar_color != header_color',
    )
    const settingsColumns = this.connection
      .prepare('PRAGMA table_info(focus_settings)')
      .all() as SqlRow<TableInfoRow>[]
    if (
      !settingsColumns.some((column) => column.name === 'maximum_manual_xp')
    ) {
      this.connection.exec(
        `ALTER TABLE focus_settings ADD COLUMN maximum_manual_xp INTEGER NOT NULL DEFAULT ${DEFAULT_MAXIMUM_MANUAL_XP}`,
      )
    }
  }

  listSkills(userId: string, includeArchived = true): SkillResponse[] {
    const archivedClause = includeArchived ? '' : 'AND s.archived_at IS NULL'
    const rows = this.connection
      .prepare(
        `
      SELECT s.id, s.name, s.code, s.emoji, s.tags, s.header_color, s.archived_at,
        s.base_xp + COALESCE(SUM(a.amount), 0) AS total_xp
      FROM skills s LEFT JOIN xp_awards a ON a.skill_id = s.id
      WHERE s.user_id = ? ${archivedClause}
      GROUP BY s.id ORDER BY s.archived_at IS NOT NULL, s.name COLLATE NOCASE
    `,
      )
      .all(userId) as SqlRow<SkillRow>[]
    const links = this.connection
      .prepare(
        `
      SELECT l.source_skill_id, l.target_skill_id, t.name AS target_name, l.percentage
      FROM skill_links l JOIN skills s ON s.id = l.source_skill_id
      JOIN skills t ON t.id = l.target_skill_id WHERE s.user_id = ?
    `,
      )
      .all(userId) as SqlRow<LinkRow>[]
    const user = this.connection
      .prepare('SELECT timezone FROM users WHERE id = ?')
      .get(userId) as { timezone: string }
    const markedDays = this.connection
      .prepare(
        'SELECT skill_id, date FROM xp_entries WHERE user_id = ? AND streak = 1 ORDER BY date DESC',
      )
      .all(userId) as SqlRow<{ skill_id: string; date: string }>[]
    const datesBySkill = new Map<string, Set<string>>()
    for (const day of markedDays) {
      const dates = datesBySkill.get(day.skill_id) ?? new Set<string>()
      dates.add(day.date)
      datesBySkill.set(day.skill_id, dates)
    }
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: user.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())

    return rows.map((row) => {
      const progression = ProgressionLogic.fromTotalXp(row.total_xp)
      return {
        id: row.id,
        name: row.name,
        code: row.code,
        emoji: row.emoji,
        tags: JSON.parse(row.tags) as string[],
        headerColor: row.header_color,
        archived: row.archived_at !== null,
        totalXp: row.total_xp,
        streakCount: this.currentStreak(datesBySkill.get(row.id), today),
        ...progression,
        links: links
          .filter((link) => link.source_skill_id === row.id)
          .map((link) => ({
            targetSkillId: link.target_skill_id,
            targetSkillName: link.target_name,
            percentage: link.percentage,
          })),
      }
    })
  }

  listEntries(userId: string, skillId?: string): XpEntryResponse[] {
    const filter =
      skillId === undefined
        ? ''
        : 'AND EXISTS (SELECT 1 FROM xp_awards a WHERE a.entry_id = e.id AND a.skill_id = ?)'
    const params = skillId === undefined ? [userId] : [userId, skillId]
    const entries = this.connection
      .prepare(
        `
      SELECT e.*, s.name AS skill_name FROM xp_entries e JOIN skills s ON s.id = e.skill_id
      WHERE e.user_id = ? ${filter} ORDER BY e.date DESC, e.created_at DESC, e.id DESC
    `,
      )
      .all(...params) as SqlRow<EntryRow>[]
    if (entries.length === 0) return []
    const awards = this.connection
      .prepare(
        `
      SELECT a.entry_id, a.skill_id, s.name AS skill_name, a.amount, a.kind, a.percentage
      FROM xp_awards a JOIN skills s ON s.id = a.skill_id
      JOIN xp_entries e ON e.id = a.entry_id WHERE e.user_id = ?
    `,
      )
      .all(userId) as SqlRow<AwardRow>[]
    const rolls = this.connection
      .prepare(
        `
      SELECT r.entry_id, r.roll FROM focus_rolls r JOIN xp_entries e ON e.id = r.entry_id
      WHERE e.user_id = ? ORDER BY r.position
    `,
      )
      .all(userId) as SqlRow<RollRow>[]

    return entries.map((entry) => ({
      id: entry.id,
      skillId: entry.skill_id,
      skillName: entry.skill_name,
      date: entry.date,
      xp: entry.xp,
      minutes: entry.minutes,
      activity: entry.activity,
      notes: entry.notes,
      streak: entry.streak === 1,
      source: entry.achievement_id === null ? entry.source : 'achievement',
      origin: entry.origin,
      createdAt: entry.created_at,
      awards: awards
        .filter((award) => award.entry_id === entry.id)
        .map((award): XpAwardResponse => ({
          skillId: award.skill_id,
          skillName: award.skill_name,
          amount: award.amount,
          kind: award.kind,
          percentage: award.percentage,
        })),
      rolls: rolls
        .filter((roll) => roll.entry_id === entry.id)
        .map((roll) => roll.roll),
    }))
  }

  private currentStreak(dates: Set<string> | undefined, today: string): number {
    if (dates === undefined || dates.size === 0) return 0
    const yesterdayDate = new Date(`${today}T00:00:00.000Z`)
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1)
    let currentDate = dates.has(today)
      ? today
      : yesterdayDate.toISOString().slice(0, 10)
    if (!dates.has(currentDate)) return 0

    let streakCount = 0
    while (dates.has(currentDate)) {
      streakCount += 1
      const previousDate = new Date(`${currentDate}T00:00:00.000Z`)
      previousDate.setUTCDate(previousDate.getUTCDate() - 1)
      currentDate = previousDate.toISOString().slice(0, 10)
    }
    return streakCount
  }

  listAchievements(userId: string, skillId?: string): AchievementResponse[] {
    return this.connection
      .prepare(
        `
      SELECT a.id, a.skill_id AS skillId, a.name, a.description, a.icon, a.xp,
        a.bonus_award AS bonusAward, a.earned_entry_id AS earnedEntryId, e.date AS obtainedAt
      FROM achievements a JOIN skills s ON s.id = a.skill_id
      LEFT JOIN xp_entries e ON e.id = a.earned_entry_id
      WHERE s.user_id = ? ${skillId ? 'AND s.id = ?' : ''}
      ORDER BY a.name COLLATE NOCASE, a.id
    `,
      )
      .all(
        ...(skillId ? [userId, skillId] : [userId]),
      ) as SqlRow<AchievementResponse>[]
  }

  getSettings(userId: string): FocusSettings {
    const row = this.connection
      .prepare('SELECT * FROM focus_settings WHERE user_id = ?')
      .get(userId) as {
      interval_minutes: number
      base_xp: number
      normal_percent: number
      natural_one_percent: number
      natural_twenty_percent: number
      maximum_manual_xp: number
    }
    return {
      intervalMinutes: row.interval_minutes,
      baseXp: row.base_xp,
      normalPercentPerPip: row.normal_percent,
      naturalOneBonusPercent: row.natural_one_percent,
      naturalTwentyBonusPercent: row.natural_twenty_percent,
      maximumManualXp: row.maximum_manual_xp,
    }
  }

  getAnkiSettings(userId: string): AnkiSettings {
    const row = this.connection
      .prepare('SELECT new_card_xp, review_xp FROM anki_settings WHERE user_id = ?')
      .get(userId) as { new_card_xp: number; review_xp: number }
    return { newCardXp: row.new_card_xp, reviewXp: row.review_xp }
  }

  updateAnkiSettings(userId: string, settings: AnkiSettings): void {
    this.connection
      .prepare(
        'UPDATE anki_settings SET new_card_xp = ?, review_xp = ? WHERE user_id = ?',
      )
      .run(settings.newCardXp, settings.reviewXp, userId)
  }

  listApiKeys(userId: string): ApiKeyResponse[] {
    return this.connection
      .prepare(
        `
      SELECT id, name, prefix, preset, created_at AS createdAt, last_used_at AS lastUsedAt
      FROM api_keys WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC
    `,
      )
      .all(userId) as SqlRow<ApiKeyResponse>[]
  }
}

