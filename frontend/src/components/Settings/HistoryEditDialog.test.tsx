import { IDBFactory } from 'fake-indexeddb'
import { AxiosHeaders, type AxiosAdapter } from 'axios'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { Provider } from 'react-redux'
import { afterEach, expect, it, vi } from 'vitest'
import { api, SESSION_KEY } from '@/api'
import { createAppStore, initialize } from '@/store'
import { AppLogic } from '@/components/App/App.logic'
import {
  calendarEntry,
  calendarSkills,
} from '@/components/HistoryCalendar/HistoryCalendar.fixtures'
import { HistoryEditDialog } from '@/components/Settings/HistoryEditDialog'

const originalAdapter = api.defaults.adapter
afterEach(() => {
  cleanup()
  api.defaults.adapter = originalAdapter
  localStorage.clear()
  vi.unstubAllGlobals()
})

it('loads, saves, removes, and cancels streak edits while refreshing the calendar data', async () => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  let entry = calendarEntry({ date: AppLogic.today(), streak: false })
  const saved: boolean[] = []
  const adapter: AxiosAdapter = async (config) => {
    if (config.method === 'put' && config.url === `/xp-entries/${entry.id}`) {
      const input = JSON.parse(config.data as string) as { streak: boolean }
      saved.push(input.streak)
      entry = { ...entry, streak: input.streak }
    }
    const data =
      config.url === '/auth/me'
        ? { id: 'editor-user', username: 'ranger', timezone: 'America/Denver' }
        : config.url === '/skills'
          ? [{ ...calendarSkills[0], streakCount: entry.streak ? 1 : 0 }]
          : config.url === '/xp-entries'
            ? [entry]
            : config.url === '/settings'
              ? {
                  intervalMinutes: 25,
                  baseXp: 100,
                  normalPercentPerPip: 1,
                  naturalOneBonusPercent: 0,
                  naturalTwentyBonusPercent: 50,
                  maximumManualXp: 2000,
                }
              : []
    return {
      data,
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      config,
    }
  }
  api.defaults.adapter = adapter
  localStorage.setItem(SESSION_KEY, 'test-session')
  const store = createAppStore()
  await store.dispatch(initialize())
  const onClose = vi.fn()
  let view = render(
    <Provider store={store}>
      <HistoryEditDialog entry={entry} onClose={onClose} />
    </Provider>,
  )
  const toggle = screen.getByRole('button', {
    name: 'Count this XP entry toward the skill streak',
  })
  expect(toggle).toHaveAttribute('aria-pressed', 'false')
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  expect(saved).toEqual([true])
  expect(store.getState().app.entries[0].streak).toBe(true)
  expect(store.getState().app.skills[0].streakCount).toBe(1)
  view.unmount()
  view = render(
    <Provider store={store}>
      <HistoryEditDialog entry={entry} onClose={onClose} />
    </Provider>,
  )
  expect(
    screen.getByRole('button', {
      name: 'Count this XP entry toward the skill streak',
    }),
  ).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Count this XP entry toward the skill streak',
    }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2))
  expect(saved).toEqual([true, false])
  expect(store.getState().app.entries[0].streak).toBe(false)
  expect(store.getState().app.skills[0].streakCount).toBe(0)
  view.unmount()
  render(
    <Provider store={store}>
      <HistoryEditDialog entry={entry} onClose={onClose} />
    </Provider>,
  )
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Count this XP entry toward the skill streak',
    }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(saved).toEqual([true, false])
  expect(entry.streak).toBe(false)
})
