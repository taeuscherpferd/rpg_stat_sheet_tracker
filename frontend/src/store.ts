import {
  configureStore,
  createAsyncThunk,
  createSlice,
  isFulfilled,
  isPending,
  isRejected,
} from '@reduxjs/toolkit'
import type {
  ApiKeyResponse,
  FocusSettings,
  SkillResponse,
  UserResponse,
  XpEntryResponse,
} from '@rlrpg/shared/contracts'
import { api, apiErrorMessage, SESSION_KEY } from '@/api'

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
  error: null,
}

const rejected = (error: Error): never => {
  throw new Error(apiErrorMessage(error))
}

export const initialize = createAsyncThunk('app/initialize', async () => {
  if (localStorage.getItem(SESSION_KEY) === null) return null
  try {
    const user = (await api.get<UserResponse>('/auth/me')).data
    const [skills, entries, settings, apiKeys] = await Promise.all([
      api.get<SkillResponse[]>('/skills'),
      api.get<XpEntryResponse[]>('/xp-entries'),
      api.get<FocusSettings>('/settings'),
      api.get<ApiKeyResponse[]>('/api-keys'),
    ])
    return {
      user,
      skills: skills.data,
      entries: entries.data,
      settings: settings.data,
      apiKeys: apiKeys.data,
    }
  } catch (error) {
    localStorage.removeItem(SESSION_KEY)
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
    const [skills, entries, settings, apiKeys] = await Promise.all([
      api.get<SkillResponse[]>('/skills'),
      api.get<XpEntryResponse[]>('/xp-entries'),
      api.get<FocusSettings>('/settings'),
      api.get<ApiKeyResponse[]>('/api-keys'),
    ])
    return {
      skills: skills.data,
      entries: entries.data,
      settings: settings.data,
      apiKeys: apiKeys.data,
    }
  } catch (error) {
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
})

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder.addCase(initialize.fulfilled, (state, action) => {
      state.initialized = true
      if (action.payload !== null) Object.assign(state, action.payload)
    })
    builder.addCase(login.fulfilled, (state, action) => {
      state.user = action.payload
      state.initialized = true
    })
    builder.addCase(register.fulfilled, (state, action) => {
      state.user = action.payload
      state.initialized = true
    })
    builder.addCase(updateProfile.fulfilled, (state, action) => {
      state.user = action.payload
    })
    builder.addCase(logout.fulfilled, () => ({
      ...initialState,
      initialized: true,
    }))
    builder.addCase(refreshData.fulfilled, (state, action) =>
      Object.assign(state, action.payload),
    )
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
      state.loading = false
      state.initialized = true
      state.error = action.error.message ?? 'Request failed'
    })
  },
})

export const { clearError } = appSlice.actions
export const store = configureStore({ reducer: { app: appSlice.reducer } })
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
