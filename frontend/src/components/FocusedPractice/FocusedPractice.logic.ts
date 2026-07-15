import type { FocusSettings } from '@rlrpg/shared/contracts'

export interface TimerState {
  skillId: string
  elapsedSeconds: number
  runningSince: number | null
  settings: FocusSettings
}

export class FocusedPracticeLogic {
  static storageKey(userId: string): string {
    return `rlrpg.focus.${userId}`
  }
  static elapsed(state: TimerState, now: number): number {
    return (
      state.elapsedSeconds +
      (state.runningSince === null
        ? 0
        : Math.max(0, Math.floor((now - state.runningSince) / 1000)))
    )
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
