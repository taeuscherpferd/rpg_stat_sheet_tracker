import {
  closeSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  rmSync,
  utimesSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { DatabaseBackup } from './DatabaseBackup.js'

const temporaryDirectories: string[] = []

const temporaryDirectory = (): string => {
  const directory = mkdtempSync(path.join(tmpdir(), 'rlrpg-backup-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('DatabaseBackup', () => {
  it('creates a consistent backup of a WAL database', async () => {
    const directory = temporaryDirectory()
    const sourcePath = path.join(directory, 'source.db')
    const backupPath = path.join(directory, 'backups', 'snapshot.db')
    const source = new DatabaseSync(sourcePath)
    source.exec('PRAGMA journal_mode = WAL')
    source.exec('CREATE TABLE entries (value TEXT NOT NULL)')
    source.prepare('INSERT INTO entries VALUES (?)').run('adventure')

    await DatabaseBackup.create(sourcePath, backupPath)

    const restored = new DatabaseSync(backupPath, { readOnly: true })
    expect(restored.prepare('SELECT value FROM entries').get()).toEqual({
      value: 'adventure',
    })
    restored.close()
    source.close()
  })

  it('prunes only expired matching backups', () => {
    const directory = temporaryDirectory()
    mkdirSync(directory, { recursive: true })
    const expired = path.join(directory, 'rlrpg-expired.db')
    const recent = path.join(directory, 'rlrpg-recent.db')
    const unrelated = path.join(directory, 'notes.db')
    for (const filePath of [expired, recent, unrelated]) {
      closeSync(openSync(filePath, 'w'))
    }
    utimesSync(expired, new Date('2026-06-01'), new Date('2026-06-01'))
    utimesSync(recent, new Date('2026-07-10'), new Date('2026-07-10'))

    expect(
      DatabaseBackup.prune(directory, 'rlrpg-', 14, new Date('2026-07-15')),
    ).toEqual([expired])
  })

  it('formats filenames without characters unsafe for common filesystems', () => {
    expect(DatabaseBackup.timestamp(new Date('2026-07-15T12:34:56.789Z'))).toBe(
      '2026-07-15T12-34-56Z',
    )
  })
})
