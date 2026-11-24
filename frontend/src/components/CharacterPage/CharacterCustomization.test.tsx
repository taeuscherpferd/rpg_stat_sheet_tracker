import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AchievementResponse } from '@rlrpg/shared/contracts'
import { afterEach, expect, it } from 'vitest'
import { CharacterPage } from '@/components/CharacterPage/CharacterPage'

const earnedAchievement: AchievementResponse = {
  id: 'achievement-earned',
  skillId: 'skill-archery',
  name: 'Master Archer',
  description: 'Hit the target',
  icon: '🏹',
  xp: 100,
  bonusAward: '',
  earnedEntryId: 'earned-entry',
  obtainedAt: '2026-11-23',
}
const lockedAchievement: AchievementResponse = {
  ...earnedAchievement,
  id: 'achievement-locked',
  name: 'Legendary Ranger',
  earnedEntryId: null,
  obtainedAt: null,
}

afterEach(() => {
  cleanup()
  localStorage.clear()
})

it('only edits appearance in the editor and saves a directly selected background per account', () => {
  localStorage.setItem('rlrpg.character.background-user', 'mira')
  localStorage.setItem('rlrpg.character.other-user', 'rowan')
  const { unmount } = render(
    <CharacterPage totalXp={100000} userId="background-user" />,
  )
  expect(
    screen.queryByRole('group', { name: 'Background' }),
  ).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Character title')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Change character' }))
  for (const backgroundName of [
    'Mountain Pass',
    'Greenwood Forest',
    'Moonlit Lake',
    'Desert Ruins',
    'Coastal Cliffs',
    'Starlit Sky',
  ]) {
    const choice = screen.getByRole('button', { name: backgroundName })
    fireEvent.click(choice)
    expect(choice).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('status')).toHaveTextContent(backgroundName)
    expect(localStorage.getItem('rlrpg.character.background-user')).toBe('mira')
  }
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(
    screen.queryByRole('group', { name: 'Background' }),
  ).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Character title')).not.toBeInTheDocument()
  unmount()
  render(<CharacterPage totalXp={100000} userId="background-user" />)
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Mira')
  fireEvent.click(screen.getByRole('button', { name: 'Change character' }))
  expect(screen.getByRole('button', { name: 'Starlit Sky' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(localStorage.getItem('rlrpg.character.other-user')).toBe('rowan')
})

it('unlocks achievement titles, restores the selection, and updates renamed or revoked titles', () => {
  localStorage.setItem('rlrpg.character.title-user', 'rowan')
  const achievements = [earnedAchievement, lockedAchievement]
  const { unmount } = render(
    <CharacterPage
      totalXp={100000}
      userId="title-user"
      achievements={achievements}
    />,
  )
  expect(screen.queryByText('The Greenwood Company')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Change character' }))
  expect(
    screen.getByRole('option', { name: 'Legendary Ranger (Locked)' }),
  ).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Character title'), {
    target: { value: earnedAchievement.id },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(screen.getByText('Master Archer')).toBeInTheDocument()
  unmount()
  const { rerender } = render(
    <CharacterPage
      totalXp={100000}
      userId="title-user"
      achievements={achievements}
    />,
  )
  expect(screen.getByText('Master Archer')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Change character' }))
  expect(screen.getByLabelText('Character title')).toHaveValue(
    earnedAchievement.id,
  )
  rerender(
    <CharacterPage
      totalXp={100000}
      userId="title-user"
      achievements={[
        { ...earnedAchievement, name: 'Royal Archer' },
        lockedAchievement,
      ]}
    />,
  )
  expect(
    screen.getByText('Royal Archer', { selector: 'span' }),
  ).toBeInTheDocument()
  rerender(
    <CharacterPage
      totalXp={100000}
      userId="title-user"
      achievements={[
        { ...earnedAchievement, earnedEntryId: null, obtainedAt: null },
        lockedAchievement,
      ]}
    />,
  )
  expect(screen.getByLabelText('Character title')).toHaveValue('')
  expect(
    screen.getByRole('option', { name: 'Master Archer (Locked)' }),
  ).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Character title'), {
    target: { value: lockedAchievement.id },
  })
  expect(screen.getByLabelText('Character title')).toHaveValue('')
})

it('saves a new character appearance and discards canceled appearance edits', () => {
  const { unmount } = render(
    <CharacterPage
      totalXp={100000}
      userId="draft-user"
      achievements={[earnedAchievement]}
    />,
  )
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Fern' } })
  fireEvent.click(screen.getByRole('button', { name: 'Greenwood Forest' }))
  fireEvent.change(screen.getByLabelText('Character title'), {
    target: { value: earnedAchievement.id },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Create character' }))
  fireEvent.click(screen.getByRole('button', { name: 'Change character' }))
  fireEvent.click(screen.getByRole('button', { name: 'Moonlit Lake' }))
  fireEvent.change(screen.getByLabelText('Character title'), {
    target: { value: '' },
  })
  fireEvent.click(
    screen.getByRole('button', { name: 'Keep current character' }),
  )
  expect(screen.getByText('Master Archer')).toBeInTheDocument()
  expect(screen.queryByLabelText('Character title')).not.toBeInTheDocument()
  unmount()
  render(
    <CharacterPage
      totalXp={100000}
      userId="draft-user"
      achievements={[earnedAchievement]}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Change character' }))
  expect(
    screen.getByRole('button', { name: 'Greenwood Forest' }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByLabelText('Character title')).toHaveValue(
    earnedAchievement.id,
  )
})
