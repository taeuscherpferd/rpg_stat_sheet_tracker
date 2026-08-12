import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SkillResponse } from '@rlrpg/shared/contracts'
import { XpAwardModal } from '@/components/XpAwardModal/XpAwardModal'
import type { XpAwardPresentation } from '@/components/XpCelebration/XpCelebration.logic'

afterEach(cleanup)

const skill: SkillResponse = {
  id: 'archery',
  name: 'Archery',
  code: 'ARC',
  emoji: '🏹',
  tags: [],
  headerColor: '#334b3f',
  archived: false,
  totalXp: 450,
  level: 2,
  levelXp: 150,
  nextLevelXp: 700,
  links: [],
}

const presentation: XpAwardPresentation = {
  awards: [
    {
      skillId: skill.id,
      skillName: skill.name,
      emoji: skill.emoji,
      amount: 100,
      previous: { level: 2, levelXp: 50, nextLevelXp: 700 },
      current: { level: 2, levelXp: 150, nextLevelXp: 700 },
    },
  ],
}

describe('XpAwardModal', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the awarded skill card and dismisses from the close button', () => {
    const onClose = vi.fn()
    render(
      <XpAwardModal
        presentation={presentation}
        skills={[skill]}
        onClose={onClose}
      />,
    )

    expect(screen.getByRole('heading', { name: 'XP awarded' })).toBeVisible()
    expect(screen.getByText('Archery')).toBeVisible()
    expect(screen.getByText('+100 XP')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledOnce()
  })
})
