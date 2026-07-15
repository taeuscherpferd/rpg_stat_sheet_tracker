import axios, { AxiosError } from 'axios'

interface ApiErrorBody {
  error?: { message?: string }
}

export const SESSION_KEY = 'rlrpg.session'

export const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(SESSION_KEY)
  if (token !== null) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const apiErrorMessage = (error: Error): string => {
  if (error instanceof AxiosError) {
    const body = error.response?.data as ApiErrorBody | undefined
    return body?.error?.message ?? 'The server could not complete that request.'
  }
  return error.message
}

export const downloadExport = async (
  path: string,
  filename: string,
): Promise<void> => {
  try {
    const response = await api.get<Blob>(path, { responseType: 'blob' })
    const url = URL.createObjectURL(response.data)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    throw new Error(apiErrorMessage(error))
  }
}
