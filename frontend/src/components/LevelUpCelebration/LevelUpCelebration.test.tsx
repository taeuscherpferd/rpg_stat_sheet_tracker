import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LevelUpCelebration } from '@/components/LevelUpCelebration/LevelUpCelebration'
import type { SkillXpAwardPresentation } from '@/components/XpCelebration/XpCelebration.logic'

afterEach(cleanup)

const makeAward = (
  skillId: string,
  skillName: string,
  previousLevel: number,
  currentLevel: number,
): SkillXpAwardPresentation => ({
  skillId,
  skillName,
  emoji: null,
  amount: 500,
  previous: {
    level: previousLevel,
    levelXp: 250,
    nextLevelXp: 300,
  },
  current: {
    level: currentLevel,
    levelXp: 450,
    nextLevelXp: 700,
  },
})

describe('LevelUpCelebration', () => {
  it('shows the former and new level before completing', () => {
    const onComplete = vi.fn()
    render(
      <LevelUpCelebration
        awards={[makeAward('archery', 'Archery', 2, 3)]}
        onComplete={onComplete}
      />,
    )

    expect(screen.getByText('Former level').parentElement).toHaveTextContent(
      '2',
    )
    expect(screen.getByText('New level').parentElement).toHaveTextContent('3')
    expect(screen.getByText('+500 XP')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Return to the ledger' }),
    )
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('steps through every skill that leveled up', () => {
    const onComplete = vi.fn()
    render(
      <LevelUpCelebration
        awards={[
          makeAward('archery', 'Archery', 2, 3),
          makeAward('agility', 'Agility', 4, 6),
        ]}
        onComplete={onComplete}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Next level up' }))

    expect(screen.getByRole('heading', { name: 'Agility' })).toBeInTheDocument()
    expect(screen.getByText('New level').parentElement).toHaveTextContent('6')
    expect(screen.getByText(/carried you across 2 levels/)).toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled()

    fireEvent.click(
      screen.getByRole('button', { name: 'Return to the ledger' }),
    )
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('celebrates a multi-level award once', () => {
    const onComplete = vi.fn()
    render(
      <LevelUpCelebration
        awards={[makeAward('archery', 'Archery', 2, 5)]}
        onComplete={onComplete}
      />,
    )

    expect(screen.getByText(/carried you across 3 levels/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Next level up' }),
    ).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Return to the ledger' }),
    )
    expect(onComplete).toHaveBeenCalledOnce()
  })
})
