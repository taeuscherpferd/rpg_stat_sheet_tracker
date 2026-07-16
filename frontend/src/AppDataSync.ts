import type {
  ApiKeyResponse,
  FocusSettings,
  SkillResponse,
  UserResponse,
  XpEntryResponse,
} from '@rlrpg/shared/contracts'
import { api } from '@/api'
import { AppSnapshotStore, type AppSnapshot } from '@/AppSnapshotStore'

export interface RemoteAppData {
  user: UserResponse
  skills: SkillResponse[]
  entries: XpEntryResponse[]
  settings: FocusSettings
  apiKeys: ApiKeyResponse[]
}

export interface InitializedAppData extends RemoteAppData {
  source: 'remote' | 'snapshot'
  lastSyncedAt: string
}

export class AppDataSync {
  static async loadRemote(): Promise<RemoteAppData> {
    const [user, skills, entries, settings, apiKeys] = await Promise.all([
      api.get<UserResponse>('/auth/me'),
      api.get<SkillResponse[]>('/skills'),
      api.get<XpEntryResponse[]>('/xp-entries'),
      api.get<FocusSettings>('/settings'),
      api.get<ApiKeyResponse[]>('/api-keys'),
    ])
    return {
      user: user.data,
      skills: skills.data,
      entries: entries.data,
      settings: settings.data,
      apiKeys: apiKeys.data,
    }
  }

  static async saveSnapshot(data: RemoteAppData): Promise<string> {
    const savedAt = new Date().toISOString()
    const snapshot: AppSnapshot = {
      schemaVersion: 1,
      savedAt,
      user: data.user,
      skills: data.skills,
      entries: data.entries,
      settings: data.settings,
    }
    try {
      await AppSnapshotStore.save(snapshot)
    } catch (error) {
      console.error('Unable to save the offline ledger snapshot', error)
    }
    return savedAt
  }

  static async loadSnapshot(): Promise<InitializedAppData | null> {
    const snapshot = await AppSnapshotStore.load()
    if (snapshot === null) return null
    return {
      user: snapshot.user,
      skills: snapshot.skills,
      entries: snapshot.entries,
      settings: snapshot.settings,
      apiKeys: [],
      source: 'snapshot',
      lastSyncedAt: snapshot.savedAt,
    }
  }

  static async clearSnapshot(): Promise<void> {
    try {
      await AppSnapshotStore.clear()
    } catch (error) {
      console.error('Unable to clear the offline ledger snapshot', error)
    }
  }
}
