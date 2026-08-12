import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { XpAwardPresentation } from '@/components/XpCelebration/XpCelebration.logic'
import { useXpAwardAnimation } from '@/components/XpCelebration/hooks/useXpAwardAnimation'

const presentation: XpAwardPresentation = {
  awards: [
    {
      skillId: 'archery',
      skillName: 'Archery',
      emoji: '🏹',
      amount: 100,
      previous: { level: 2, levelXp: 50, nextLevelXp: 700 },
      current: { level: 2, levelXp: 150, nextLevelXp: 700 },
    },
  ],
}

describe('useXpAwardAnimation', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('commits the pre-award progress on its first render', () => {
    const { result } = renderHook(() => useXpAwardAnimation(presentation))

    expect(result.current.progressBySkillId.archery).toMatchObject({
      level: 2,
      levelXp: 50,
      nextLevelXp: 700,
      animate: false,
      transitionMs: 0,
    })
    expect(result.current.readyForCelebration).toBe(false)
  })
})
