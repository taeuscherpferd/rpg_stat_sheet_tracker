import type {
  FocusSettings,
  SkillResponse,
  UserResponse,
  XpEntryResponse,
} from '@rlrpg/shared/contracts'
import { DEFAULT_MAXIMUM_MANUAL_XP } from '@rlrpg/shared/rules'

const databaseName = 'rlrpg-offline'
const databaseVersion = 1
const snapshotKey = 'current-user'
const storeName = 'snapshots'

export interface AppSnapshot {
  schemaVersion: 2
  savedAt: string
  user: UserResponse
  skills: SkillResponse[]
  entries: XpEntryResponse[]
  settings: FocusSettings
}

interface LegacyAppSnapshot {
  schemaVersion: 1
  savedAt: string
  user: UserResponse
  skills: SkillResponse[]
  entries: XpEntryResponse[]
  settings: Omit<FocusSettings, 'maximumManualXp'>
}

type StoredAppSnapshot = AppSnapshot | LegacyAppSnapshot

const requestResult = <Result>(request: IDBRequest<Result>): Promise<Result> =>
  new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result))
    request.addEventListener('error', () =>
      reject(request.error ?? new Error('IndexedDB request failed')),
    )
  })

const openDatabase = (factory: IDBFactory): Promise<IDBDatabase> => {
  const request = factory.open(databaseName, databaseVersion)
  request.addEventListener('upgradeneeded', () => {
    if (!request.result.objectStoreNames.contains(storeName)) {
      request.result.createObjectStore(storeName)
    }
  })
  return requestResult(request)
}

const transactionCompletion = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve())
    transaction.addEventListener('error', () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed')),
    )
    transaction.addEventListener('abort', () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted')),
    )
  })

const transact = async <Result>(
  factory: IDBFactory,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<Result>,
): Promise<Result> => {
  const database = await openDatabase(factory)
  try {
    const transaction = database.transaction(storeName, mode)
    const result = requestResult(operation(transaction.objectStore(storeName)))
    const [value] = await Promise.all([
      result,
      transactionCompletion(transaction),
    ])
    return value
  } finally {
    database.close()
  }
}

export class AppSnapshotStore {
  static async load(
    factory: IDBFactory = indexedDB,
  ): Promise<AppSnapshot | null> {
    const snapshot = await transact(
      factory,
      'readonly',
      (store) =>
        store.get(snapshotKey) as IDBRequest<StoredAppSnapshot | undefined>,
    )
    if (snapshot === undefined) return null
    if (snapshot.schemaVersion === 2) return snapshot

    return {
      ...snapshot,
      schemaVersion: 2,
      settings: {
        ...snapshot.settings,
        maximumManualXp: DEFAULT_MAXIMUM_MANUAL_XP,
      },
    }
  }

  static async save(
    snapshot: AppSnapshot,
    factory: IDBFactory = indexedDB,
  ): Promise<void> {
    await transact(factory, 'readwrite', (store) =>
      store.put(snapshot, snapshotKey),
    )
  }

  static async clear(factory: IDBFactory = indexedDB): Promise<void> {
    await transact(factory, 'readwrite', (store) => store.delete(snapshotKey))
  }
}
