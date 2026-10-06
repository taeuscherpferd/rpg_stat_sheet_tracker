import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { afterEach, expect, it } from 'vitest'
import { AxiosHeaders, type AxiosAdapter } from 'axios'
import type {
  AchievementResponse,
  SkillResponse,
} from '@rlrpg/shared/contracts'
import { api, SESSION_KEY } from '@/api'
import { createAppStore, initialize } from '@/store'
import { SkillDetails } from './SkillDetails'
import { SkillCard } from '@/components/SkillCard/SkillCard'

const skill: SkillResponse = {
  id: 'skill-1',
  name: 'Archery',
  code: 'ARC',
  emoji: '🏹',
  tags: [],
  headerColor: '#334b3f',
  archived: false,
  totalXp: 100,
  level: 1,
  levelXp: 100,
  nextLevelXp: 300,
  links: [],
}
const originalAdapter = api.defaults.adapter
afterEach(() => {
  api.defaults.adapter = originalAdapter
  localStorage.clear()
})

it('opens details from the tile and XP from its separate plus button', () => {
  const clicked: string[] = []
  render(
    <SkillCard
      skill={skill}
      onDetails={() => clicked.push('details')}
      onLogXp={() => clicked.push('xp')}
      onEdit={() => clicked.push('edit')}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: /Archery.*ARC/ }))
  fireEvent.click(screen.getByTitle('Add XP to Archery'))
  fireEvent.click(screen.getByTitle('Edit skill'))
  expect(clicked).toEqual(['details', 'xp', 'edit'])
})

it('shows unearned achievements and obtains one through its details', async () => {
  let achievement: AchievementResponse = {
    id: 'achievement-1',
    skillId: skill.id,
    name: 'Bullseye',
    icon: '🎯',
    description: 'Hit the center',
    xp: 50,
    bonusAward: 'New arrows',
    earnedEntryId: null,
    obtainedAt: null,
  }
  const adapter: AxiosAdapter = async (config) => {
    if (config.url === '/achievements/achievement-1/obtained') {
      expect(JSON.parse(config.data as string)).toEqual({ obtained: true })
      achievement = {
        ...achievement,
        earnedEntryId: 'entry-1',
        obtainedAt: '2026-10-06',
      }
    }
    const data =
      config.url === '/auth/me'
        ? { id: 'user-1', username: 'ranger', timezone: 'America/Denver' }
        : config.url === '/skills'
          ? [skill]
          : config.url === '/achievements'
            ? [achievement]
            : config.url === '/settings'
              ? { maximumManualXp: 2000 }
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
  render(
    <Provider store={store}>
      <SkillDetails skill={skill} onClose={() => {}} />
    </Provider>,
  )
  fireEvent.click(screen.getByTitle('Bullseye · Not obtained'))
  expect(screen.getByLabelText('Name')).toHaveValue('Bullseye')
  expect(screen.getByLabelText('Bonus award')).toHaveValue('New arrows')
  fireEvent.click(
    screen.getByRole('button', { name: 'Mark obtained (+50 XP)' }),
  )
  await waitFor(() =>
    expect(screen.getByTitle('Bullseye · Obtained')).toBeInTheDocument(),
  )
  fireEvent.click(screen.getByTitle('Bullseye · Obtained'))
  expect(
    screen.getByRole('button', { name: 'Undo achievement and XP' }),
  ).toBeInTheDocument()
  expect(screen.getByLabelText('XP reward')).toBeDisabled()
})
