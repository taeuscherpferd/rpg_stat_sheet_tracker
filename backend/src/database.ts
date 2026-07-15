import { DatabaseSync, type SQLOutputValue } from 'node:sqlite'
import type {
  ApiKeyResponse,
  FocusSettings,
  SkillResponse,
  XpAwardResponse,
  XpEntryResponse,
} from '@rlrpg/shared/contracts'
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
  source: 'manual' | 'focus' | 'automation'
  origin: string | null
  created_at: string
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
        natural_twenty_percent INTEGER NOT NULL DEFAULT 50
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
    const filter = skillId === undefined ? '' : 'AND e.skill_id = ?'
    const params = skillId === undefined ? [userId] : [userId, skillId]
    const entries = this.connection
      .prepare(
        `
      SELECT e.*, s.name AS skill_name FROM xp_entries e JOIN skills s ON s.id = e.skill_id
      WHERE e.user_id = ? ${filter} ORDER BY e.date DESC, e.created_at DESC LIMIT 500
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
      source: entry.source,
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

  getSettings(userId: string): FocusSettings {
    const row = this.connection
      .prepare('SELECT * FROM focus_settings WHERE user_id = ?')
      .get(userId) as {
      interval_minutes: number
      base_xp: number
      normal_percent: number
      natural_one_percent: number
      natural_twenty_percent: number
    }
    return {
      intervalMinutes: row.interval_minutes,
      baseXp: row.base_xp,
      normalPercentPerPip: row.normal_percent,
      naturalOneBonusPercent: row.natural_one_percent,
      naturalTwentyBonusPercent: row.natural_twenty_percent,
    }
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
