import type { FocusSettings } from '@rlrpg/shared/contracts'
import { FocusRules } from '@rlrpg/shared/rules'

export interface TimerState {
  skillId: string
  elapsedSeconds: number
  runningSince: number | null
  settings: FocusSettings
}

export interface CompletionTimerState {
  timer: TimerState
  shouldResume: boolean
}

export class FocusedPracticeLogic {
  static storageKey(userId: string): string {
    return `rlrpg.focus.${userId}`
  }
  static lastSkillStorageKey(userId: string): string {
    return `rlrpg.focus.lastSkill.${userId}`
  }
  static preferredSkillId(
    storedSkillId: string | null,
    activeSkillIds: string[],
  ): string {
    return storedSkillId !== null && activeSkillIds.includes(storedSkillId)
      ? storedSkillId
      : (activeSkillIds[0] ?? '')
  }
  static elapsed(state: TimerState, now: number): number {
    return (
      state.elapsedSeconds +
      (state.runningSince === null
        ? 0
        : Math.max(0, Math.floor((now - state.runningSince) / 1000)))
    )
  }
  static durationSeconds(state: TimerState): number {
    return state.settings.intervalMinutes * 60
  }
  static remaining(state: TimerState, now: number): number {
    const duration = this.durationSeconds(state)
    const elapsed = this.elapsed(state, now)
    const elapsedInInterval = elapsed % duration
    return elapsed > 0 && elapsedInInterval === 0
      ? 0
      : duration - elapsedInInterval
  }
  static drainedFraction(state: TimerState, now: number): number {
    const duration = this.durationSeconds(state)
    const elapsed = this.elapsed(state, now)
    const elapsedInInterval = elapsed % duration
    return elapsed > 0 && elapsedInInterval === 0
      ? 1
      : elapsedInInterval / duration
  }
  static pause(state: TimerState, now: number): TimerState {
    return {
      ...state,
      elapsedSeconds: this.elapsed(state, now),
      runningSince: null,
    }
  }
  static resume(state: TimerState, now: number): TimerState {
    return state.runningSince === null ? { ...state, runningSince: now } : state
  }
  static pauseForCompletion(
    state: TimerState,
    now: number,
  ): CompletionTimerState {
    return {
      timer: this.pause(state, now),
      shouldResume: state.runningSince !== null,
    }
  }
  static cancelCompletion(
    state: TimerState,
    shouldResume: boolean,
    now: number,
  ): TimerState {
    return shouldResume ? this.resume(state, now) : state
  }
  static focusedSecondsForRetainedIntervals(
    focusedSeconds: number,
    intervalMinutes: number,
    retainedIntervals: number,
  ): number {
    const completedIntervals = FocusRules.completedIntervals(
      focusedSeconds,
      intervalMinutes,
    )
    const discardedIntervals =
      completedIntervals -
      Math.min(Math.max(retainedIntervals, 0), completedIntervals)
    return focusedSeconds - discardedIntervals * intervalMinutes * 60
  }
  static parseRollValues(values: string[]): number[] | null {
    if (values.length === 0) return null
    const rolls: number[] = []
    for (const value of values) {
      if (value.trim() === '') return null
      const roll = Number(value)
      if (!Number.isInteger(roll) || roll < 1 || roll > 20) return null
      rolls.push(roll)
    }
    return rolls
  }
  static format(seconds: number): string {
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  }
  static load(value: string | null): TimerState | null {
    if (value === null) return null
    try {
      const parsed = JSON.parse(value) as TimerState
      return typeof parsed.skillId === 'string' &&
        typeof parsed.elapsedSeconds === 'number'
        ? parsed
        : null
    } catch {
      return null
    }
  }
}
