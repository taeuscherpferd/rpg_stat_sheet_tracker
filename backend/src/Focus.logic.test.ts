import { describe, expect, it } from 'vitest'
import { FocusLogic } from './Focus.logic.js'

const settings = {
  intervalMinutes: 25,
  baseXp: 100,
  normalPercentPerPip: 1,
  naturalOneBonusPercent: 0,
  naturalTwentyBonusPercent: 50,
}

describe('FocusLogic', () => {
  it('counts only full intervals', () => {
    expect(FocusLogic.completedIntervals(2999, 25)).toBe(1)
  })
  it('applies normal and critical roll rules', () => {
    expect(FocusLogic.xpForRoll(1, settings)).toBe(100)
    expect(FocusLogic.xpForRoll(14, settings)).toBe(114)
    expect(FocusLogic.xpForRoll(20, settings)).toBe(150)
    expect(FocusLogic.totalXp([1, 20], settings)).toBe(250)
  })
})
