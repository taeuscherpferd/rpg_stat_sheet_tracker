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
  it('pauses a running timer for completion and resumes it after cancellation', () => {
    const completionTimer = FocusedPracticeLogic.pauseForCompletion(timer, 6500)

    expect(completionTimer).toEqual({
      timer: { ...timer, elapsedSeconds: 15, runningSince: null },
      shouldResume: true,
    })
    expect(
      FocusedPracticeLogic.cancelCompletion(
        completionTimer.timer,
        completionTimer.shouldResume,
        8000,
      ),
    ).toEqual({ ...timer, elapsedSeconds: 15, runningSince: 8000 })
  })
  it('keeps a manually paused timer paused after completion is cancelled', () => {
    const pausedTimer = { ...timer, runningSince: null }
    const completionTimer = FocusedPracticeLogic.pauseForCompletion(
      pausedTimer,
      6500,
    )

    expect(completionTimer.shouldResume).toBe(false)
    expect(
      FocusedPracticeLogic.cancelCompletion(
        completionTimer.timer,
        completionTimer.shouldResume,
        8000,
      ),
    ).toBe(completionTimer.timer)
  })
  it('counts down each configured interval', () => {
    expect(FocusedPracticeLogic.durationSeconds(timer)).toBe(1500)
    expect(FocusedPracticeLogic.remaining(timer, 6500)).toBe(1485)
    expect(FocusedPracticeLogic.drainedFraction(timer, 6500)).toBe(0.01)
    expect(FocusedPracticeLogic.remaining(timer, 1_491_000)).toBe(0)
    expect(FocusedPracticeLogic.drainedFraction(timer, 1_491_000)).toBe(1)
    expect(FocusedPracticeLogic.remaining(timer, 1_492_000)).toBe(1499)
    expect(FocusedPracticeLogic.drainedFraction(timer, 1_492_000)).toBeCloseTo(
      1 / 1500,
    )
    expect(FocusedPracticeLogic.remaining(timer, 2_991_000)).toBe(0)
  })
  it('formats time and safely restores state', () => {
    expect(FocusedPracticeLogic.format(1505)).toBe('25:05')
    expect(FocusedPracticeLogic.storageKey('user')).toBe('rlrpg.focus.user')
    expect(FocusedPracticeLogic.load(null)).toBeNull()
    expect(FocusedPracticeLogic.load('{bad')).toBeNull()
    expect(FocusedPracticeLogic.load(JSON.stringify(timer))).toEqual(timer)
    expect(FocusedPracticeLogic.load('{}')).toBeNull()
  })
  it('restores the last active skill practiced', () => {
    expect(FocusedPracticeLogic.lastSkillStorageKey('user')).toBe(
      'rlrpg.focus.lastSkill.user',
    )
    expect(
      FocusedPracticeLogic.preferredSkillId('second', ['first', 'second']),
    ).toBe('second')
    expect(
      FocusedPracticeLogic.preferredSkillId('archived', ['first', 'second']),
    ).toBe('first')
    expect(FocusedPracticeLogic.preferredSkillId(null, [])).toBe('')
  })
})
