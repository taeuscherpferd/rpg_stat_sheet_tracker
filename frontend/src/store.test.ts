import { IDBFactory } from 'fake-indexeddb'
import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  ApiKeyResponse,
  FocusSettings,
  UserResponse,
} from '@rlrpg/shared/contracts'
import { api, SESSION_KEY } from '@/api'
import { AppSnapshotStore, type AppSnapshot } from '@/AppSnapshotStore'
import { createAppStore, initialize } from '@/store'

const user: UserResponse = {
  id: 'user-1',
  username: 'ranger',
  timezone: 'America/Denver',
}
const settings: FocusSettings = {
  intervalMinutes: 25,
  baseXp: 10,
  normalPercentPerPip: 10,
  naturalOneBonusPercent: 50,
  naturalTwentyBonusPercent: 50,
}
const apiKeys: ApiKeyResponse[] = [
  {
    id: 'key-1',
    name: 'Desktop automation',
    prefix: 'abcd',
    preset: 'reader',
    createdAt: '2026-07-16T10:00:00.000Z',
    lastUsedAt: null,
  },
]
const snapshot: AppSnapshot = {
  schemaVersion: 1,
  savedAt: '2026-07-16T12:00:00.000Z',
  user,
  skills: [],
  entries: [],
  settings,
}

const response = (
  config: InternalAxiosRequestConfig,
  data: UserResponse | FocusSettings | ApiKeyResponse[],
): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: new AxiosHeaders(),
  config,
})

describe('offline initialization', () => {
  const originalAdapter = api.defaults.adapter

  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('indexedDB', new IDBFactory())
  })

  afterEach(() => {
    api.defaults.adapter = originalAdapter
    vi.unstubAllGlobals()
  })

  it('saves successful remote data without persisting API key metadata', async () => {
    const adapter: AxiosAdapter = async (config) => {
      switch (config.url) {
        case '/auth/me':
          return response(config, user)
        case '/settings':
          return response(config, settings)
        case '/api-keys':
          return response(config, apiKeys)
        default:
          return response(config, [])
      }
    }
    api.defaults.adapter = adapter
    localStorage.setItem(SESSION_KEY, 'session-token')

    const store = createAppStore()
    await store.dispatch(initialize())

    expect(store.getState().app).toMatchObject({
      user,
      apiKeys,
      connection: 'online',
      hasLoadedData: true,
    })
    expect(await AppSnapshotStore.load()).toMatchObject({
      user,
      skills: [],
      entries: [],
      settings,
    })
    expect(await AppSnapshotStore.load()).not.toHaveProperty('apiKeys')
  })

  it('hydrates the snapshot and preserves the session on a network failure', async () => {
    await AppSnapshotStore.save(snapshot)
    const adapter: AxiosAdapter = async (config) => {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config)
    }
    api.defaults.adapter = adapter
    localStorage.setItem(SESSION_KEY, 'session-token')

    const store = createAppStore()
    await store.dispatch(initialize())

    expect(store.getState().app).toMatchObject({
      user,
      skills: [],
      entries: [],
      settings,
      apiKeys: [],
      connection: 'offline',
      lastSyncedAt: snapshot.savedAt,
    })
    expect(localStorage.getItem(SESSION_KEY)).toBe('session-token')
  })

  it('clears the session and snapshot after an unauthorized response', async () => {
    await AppSnapshotStore.save(snapshot)
    const adapter: AxiosAdapter = async (config) => {
      const unauthorizedResponse: AxiosResponse = {
        data: { error: { message: 'Session expired' } },
        status: 401,
        statusText: 'Unauthorized',
        headers: new AxiosHeaders(),
        config,
      }
      throw new AxiosError(
        'Request failed with status code 401',
        AxiosError.ERR_BAD_REQUEST,
        config,
        undefined,
        unauthorizedResponse,
      )
    }
    api.defaults.adapter = adapter
    localStorage.setItem(SESSION_KEY, 'expired-token')

    const store = createAppStore()
    await store.dispatch(initialize())

    expect(store.getState().app.user).toBeNull()
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
    expect(await AppSnapshotStore.load()).toBeNull()
  })
})
