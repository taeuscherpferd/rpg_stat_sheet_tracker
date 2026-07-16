import { backup, DatabaseSync, type SQLOutputValue } from 'node:sqlite'
import {
  chmodSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  unlinkSync,
} from 'node:fs'
import path from 'node:path'

type IntegrityRow = Record<string, SQLOutputValue> & {
  integrity_check: string
}

export class DatabaseBackup {
  static async create(databasePath: string, backupPath: string): Promise<void> {
    mkdirSync(path.dirname(backupPath), { recursive: true })
    let completed = false
    try {
      const database = new DatabaseSync(databasePath, { readOnly: true })
      try {
        await backup(database, backupPath)
      } finally {
        database.close()
      }
      this.verify(backupPath)
      chmodSync(backupPath, 0o600)
      completed = true
    } finally {
      if (!completed) rmSync(backupPath, { force: true })
    }
  }

  static verify(backupPath: string): void {
    const database = new DatabaseSync(backupPath, { readOnly: true })
    try {
      const result = database.prepare('PRAGMA integrity_check').get() as
        IntegrityRow | undefined
      if (result?.integrity_check !== 'ok') {
        throw new Error(
          `Backup integrity check failed: ${String(result?.integrity_check ?? 'no result')}`,
        )
      }
    } finally {
      database.close()
    }
  }

  static prune(
    directory: string,
    prefix: string,
    retentionDays: number,
    now = new Date(),
  ): string[] {
    const cutoff = now.getTime() - retentionDays * 24 * 60 * 60_000
    const removed: string[] = []
    for (const filename of readdirSync(directory)) {
      if (!filename.startsWith(prefix) || !filename.endsWith('.db')) continue
      const filePath = path.join(directory, filename)
      if (statSync(filePath).mtimeMs >= cutoff) continue
      unlinkSync(filePath)
      removed.push(filePath)
    }
    return removed
  }

  static timestamp(date = new Date()): string {
    return date
      .toISOString()
      .replaceAll(':', '-')
      .replace(/\.\d{3}Z$/, 'Z')
  }
}
