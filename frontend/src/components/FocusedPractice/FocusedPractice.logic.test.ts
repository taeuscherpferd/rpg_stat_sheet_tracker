import { describe, expect, it } from 'vitest'
import { FocusedPracticeLogic, type TimerState } from './FocusedPractice.logic'

const timer: TimerState = {
  skillId: 'skill',
  elapsedSeconds: 10,
  runningSince: 1000,
  settings: {
    intervalMinutes: 25,
    baseXp: 100,
    normalPercentPerPip: 1,
    naturalOneBonusPercent: 0,
    naturalTwentyBonusPercent: 50,
  },
}

describe('FocusedPracticeLogic', () => {
  it('calculates, pauses, and resumes elapsed time', () => {
    expect(FocusedPracticeLogic.elapsed(timer, 6500)).toBe(15)
    expect(FocusedPracticeLogic.pause(timer, 6500)).toMatchObject({
      elapsedSeconds: 15,
      runningSince: null,
    })
    expect(
      FocusedPracticeLogic.resume({ ...timer, runningSince: null }, 8000)
        .runningSince,
    ).toBe(8000)
    expect(FocusedPracticeLogic.resume(timer, 8000)).toBe(timer)
  })
  it('formats time and safely restores state', () => {
    expect(FocusedPracticeLogic.format(1505)).toBe('25:05')
    expect(FocusedPracticeLogic.storageKey('user')).toBe('rlrpg.focus.user')
    expect(FocusedPracticeLogic.load(null)).toBeNull()
    expect(FocusedPracticeLogic.load('{bad')).toBeNull()
    expect(FocusedPracticeLogic.load(JSON.stringify(timer))).toEqual(timer)
    expect(FocusedPracticeLogic.load('{}')).toBeNull()
  })
})
