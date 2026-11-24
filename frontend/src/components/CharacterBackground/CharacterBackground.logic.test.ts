import { expect, it } from 'vitest'
import { CharacterBackgroundLogic } from '@/components/CharacterBackground/CharacterBackground.logic'
import { characterBackgrounds } from '@/components/CharacterBackground/CharacterBackground.data'

it('totals XP across all supplied skills, including archived skills', () => {
  const skills = [
    { totalXp: 250, archived: false },
    { totalXp: 1250, archived: true },
    { totalXp: -10, archived: false },
  ]
  expect(CharacterBackgroundLogic.totalXp(skills)).toBe(1500)
  expect(CharacterBackgroundLogic.totalXp([])).toBe(0)
})

it('unlocks each background at its exact XP requirement', () => {
  for (const background of characterBackgrounds) {
    expect(
      CharacterBackgroundLogic.isUnlocked(background.id, background.requiredXp),
    ).toBe(true)
    if (background.requiredXp > 0) {
      expect(
        CharacterBackgroundLogic.isUnlocked(
          background.id,
          background.requiredXp - 1,
        ),
      ).toBe(false)
    }
  }
  expect(CharacterBackgroundLogic.isUnlocked('forest', -1)).toBe(true)
  expect(CharacterBackgroundLogic.isUnlocked('missing', 100000)).toBe(false)
})

it('falls back to the starter scene when a background is locked or invalid', () => {
  expect(CharacterBackgroundLogic.availableBackground('stars', 100000)).toBe(
    'stars',
  )
  expect(CharacterBackgroundLogic.availableBackground('stars', 99999)).toBe(
    'forest',
  )
  expect(CharacterBackgroundLogic.availableBackground('missing', 100000)).toBe(
    'forest',
  )
})
