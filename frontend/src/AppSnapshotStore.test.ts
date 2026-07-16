import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import type { AppSnapshot } from '@/AppSnapshotStore'
import { AppSnapshotStore } from '@/AppSnapshotStore'

const snapshot: AppSnapshot = {
  schemaVersion: 1,
  savedAt: '2026-07-16T12:00:00.000Z',
  user: { id: 'user-1', username: 'ranger', timezone: 'America/Denver' },
  skills: [],
  entries: [],
  settings: {
    intervalMinutes: 25,
    baseXp: 10,
    normalPercentPerPip: 10,
    naturalOneBonusPercent: 50,
    naturalTwentyBonusPercent: 50,
  },
}

describe('AppSnapshotStore', () => {
  it('returns null before a snapshot has been saved', async () => {
    expect(await AppSnapshotStore.load(new IDBFactory())).toBeNull()
  })

  it('saves and replaces the current snapshot', async () => {
    const factory = new IDBFactory()
    await AppSnapshotStore.save(snapshot, factory)
    expect(await AppSnapshotStore.load(factory)).toEqual(snapshot)

    const replacement = { ...snapshot, savedAt: '2026-07-16T13:00:00.000Z' }
    await AppSnapshotStore.save(replacement, factory)
    expect(await AppSnapshotStore.load(factory)).toEqual(replacement)
  })

  it('clears the saved snapshot', async () => {
    const factory = new IDBFactory()
    await AppSnapshotStore.save(snapshot, factory)
    await AppSnapshotStore.clear(factory)
    expect(await AppSnapshotStore.load(factory)).toBeNull()
  })
})
