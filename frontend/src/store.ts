import {
  configureStore,
  createAsyncThunk,
  createSlice,
  isFulfilled,
  isPending,
  isRejected,
  type PayloadAction,
} from '@reduxjs/toolkit'
import type {
  ApiKeyResponse,
  FocusSettings,
  SkillResponse,
  UserResponse,
  XpEntryResponse,
} from '@rlrpg/shared/contracts'
import {
  api,
  apiErrorMessage,
  apiErrorStatus,
  isNetworkError,
  SESSION_KEY,
} from '@/api'
import { AppDataSync, type InitializedAppData } from '@/AppDataSync'

interface AuthPayload {
  token: string
  user: UserResponse
}

interface ApiKeyCreated {
  token: string
  apiKey: ApiKeyResponse
}

interface AppState {
  user: UserResponse | null
  skills: SkillResponse[]
  entries: XpEntryResponse[]
  settings: FocusSettings | null
  apiKeys: ApiKeyResponse[]
  loading: boolean
  initialized: boolean
  hasLoadedData: boolean
  connection: 'online' | 'offline'
  lastSyncedAt: string | null
  error: string | null
}

const initialState: AppState = {
  user: null,
  skills: [],
  entries: [],
  settings: null,
  apiKeys: [],
  loading: false,
  initialized: false,
  hasLoadedData: false,
  connection: navigator.onLine ? 'online' : 'offline',
  lastSyncedAt: null,
  error: null,
}

class NetworkUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NetworkUnavailableError'
  }
}

class AuthenticationRequiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthenticationRequiredError'
  }
}

const rejected = (error: Error): never => {
  if (isNetworkError(error))
    throw new NetworkUnavailableError(apiErrorMessage(error))
  throw new Error(apiErrorMessage(error))
}

export const initialize = createAsyncThunk('app/initialize', async () => {
  if (localStorage.getItem(SESSION_KEY) === null) {
    await AppDataSync.clearSnapshot()
    return null
  }
  try {
    const data = await AppDataSync.loadRemote()
    return {
      ...data,
      source: 'remote',
      lastSyncedAt: await AppDataSync.saveSnapshot(data),
    } satisfies InitializedAppData
  } catch (error) {
    const status = apiErrorStatus(error)
    if (status === 401 || status === 403) {
      localStorage.removeItem(SESSION_KEY)
      await AppDataSync.clearSnapshot()
      throw new AuthenticationRequiredError(apiErrorMessage(error))
    }
    if (!isNetworkError(error)) return rejected(error)
    try {
      const snapshot = await AppDataSync.loadSnapshot()
      if (snapshot !== null) return snapshot
    } catch (snapshotError) {
      console.error('Unable to load the offline ledger snapshot', snapshotError)
    }
    return rejected(error)
  }
})

export const login = createAsyncThunk(
  'app/login',
  async (input: { username: string; password: string }) => {
    try {
      const response = await api.post<AuthPayload>('/auth/login', input)
      localStorage.setItem(SESSION_KEY, response.data.token)
      return response.data.user
    } catch (error) {
      return rejected(error)
    }
  },
)

export const register = createAsyncThunk(
  'app/register',
  async (input: { username: string; password: string }) => {
    try {
      const response = await api.post<AuthPayload>('/auth/register', {
        ...input,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      localStorage.setItem(SESSION_KEY, response.data.token)
      return response.data.user
    } catch (error) {
      return rejected(error)
    }
  },
)

export const updateProfile = createAsyncThunk(
  'app/updateProfile',
  async (input: { username: string }) => {
    try {
      return (await api.put<UserResponse>('/auth/me', input)).data
    } catch (error) {
      return rejected(error)
    }
  },
)

export const refreshData = createAsyncThunk('app/refresh', async () => {
  try {
    const data = await AppDataSync.loadRemote()
    return {
      ...data,
      lastSyncedAt: await AppDataSync.saveSnapshot(data),
    }
  } catch (error) {
    const status = apiErrorStatus(error)
    if (status === 401 || status === 403) {
      localStorage.removeItem(SESSION_KEY)
      await AppDataSync.clearSnapshot()
      throw new AuthenticationRequiredError(apiErrorMessage(error))
    }
    return rejected(error)
  }
})

export const saveSkill = createAsyncThunk(
  'app/saveSkill',
  async (input: {
    id?: string
    name: string
    code: string
    emoji: string | null
    tags: string[]
    headerColor: string
    startingLevel?: number
    links: { targetSkillId: string; percentage: number }[]
  }) => {
    try {
      if (input.id === undefined) await api.post('/skills', input)
      else await api.put(`/skills/${input.id}`, input)
    } catch (error) {
      return rejected(error)
    }
  },
)

export const setSkillArchived = createAsyncThunk(
  'app/archiveSkill',
  async (input: { id: string; archived: boolean }) => {
    try {
      await api.post(
        `/skills/${input.id}/${input.archived ? 'archive' : 'restore'}`,
      )
    } catch (error) {
      return rejected(error)
    }
  },
)

export const addXp = createAsyncThunk(
  'app/addXp',
  async (input: {
    skillId: string
    date: string
    xp: number
    minutes: number | null
    activity: string | null
    notes: string | null
  }) => {
    try {
      await api.post('/xp-entries', input)
    } catch (error) {
      return rejected(error)
    }
  },
)

export const editXp = createAsyncThunk(
  'app/editXp',
  async (input: {
    id: string
    date: string
    xp: number
    minutes: number | null
    activity: string | null
    notes: string | null
  }) => {
    try {
      await api.put(`/xp-entries/${input.id}`, input)
    } catch (error) {
      return rejected(error)
    }
  },
)

export const deleteXp = createAsyncThunk('app/deleteXp', async (id: string) => {
  try {
    await api.delete(`/xp-entries/${id}`)
  } catch (error) {
    return rejected(error)
  }
})

export const saveSettings = createAsyncThunk(
  'app/saveSettings',
  async (settings: FocusSettings) => {
    try {
      await api.put('/settings', settings)
    } catch (error) {
      return rejected(error)
    }
  },
)

export const completeFocus = createAsyncThunk(
  'app/completeFocus',
  async (input: {
    skillId: string
    date: string
    focusedSeconds: number
    rolls: number[]
    notes: string | null
    settings: FocusSettings
  }) => {
    try {
      await api.post('/focus-sessions', input)
    } catch (error) {
      return rejected(error)
    }
  },
)

export const createApiKey = createAsyncThunk(
  'app/createApiKey',
  async (input: { name: string; preset: 'reader' | 'writer' }) => {
    try {
      return (await api.post<ApiKeyCreated>('/api-keys', input)).data
    } catch (error) {
      return rejected(error)
    }
  },
)

export const revokeApiKey = createAsyncThunk(
  'app/revokeApiKey',
  async (id: string) => {
    try {
      await api.delete(`/api-keys/${id}`)
    } catch (error) {
      return rejected(error)
    }
  },
)

export const logout = createAsyncThunk('app/logout', async () => {
  try {
    await api.post('/auth/logout')
  } catch {
    /* Local logout still succeeds if the server session has expired. */
  }
  localStorage.removeItem(SESSION_KEY)
  await AppDataSync.clearSnapshot()
})

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    connectionChanged: (state, action: PayloadAction<boolean>) => {
      state.connection = action.payload ? 'online' : 'offline'
    },
  },
  extraReducers: (builder) => {
    builder.addCase(initialize.fulfilled, (state, action) => {
      state.initialized = true
      if (action.payload !== null) {
        const { source, ...data } = action.payload
        Object.assign(state, data)
        state.hasLoadedData = true
        state.connection = source === 'remote' ? 'online' : 'offline'
      }
    })
    builder.addCase(login.fulfilled, (state, action) => {
      state.user = action.payload
      state.initialized = true
      state.hasLoadedData = false
      state.connection = 'online'
    })
    builder.addCase(register.fulfilled, (state, action) => {
      state.user = action.payload
      state.initialized = true
      state.hasLoadedData = false
      state.connection = 'online'
    })
    builder.addCase(updateProfile.fulfilled, (state, action) => {
      state.user = action.payload
    })
    builder.addCase(logout.fulfilled, () => ({
      ...initialState,
      initialized: true,
    }))
    builder.addCase(refreshData.fulfilled, (state, action) => {
      Object.assign(state, action.payload)
      state.hasLoadedData = true
      state.connection = 'online'
    })
    builder.addCase(createApiKey.fulfilled, (state, action) => {
      state.apiKeys.unshift(action.payload.apiKey)
    })
    builder.addMatcher(isPending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addMatcher(isFulfilled, (state) => {
      state.loading = false
    })
    builder.addMatcher(isRejected, (state, action) => {
      if (action.error.name === 'AuthenticationRequiredError') {
        return {
          ...initialState,
          initialized: true,
          error: action.error.message ?? 'Authentication required',
        }
      }
      state.loading = false
      state.initialized = true
      if (action.error.name === 'NetworkUnavailableError') {
        state.connection = 'offline'
      }
      state.error = action.error.message ?? 'Request failed'
    })
  },
})

export const { clearError, connectionChanged } = appSlice.actions
export const createAppStore = () =>
  configureStore({ reducer: { app: appSlice.reducer } })
export const store = createAppStore()
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
