import type { FocusSettings } from '@rlrpg/shared/contracts'
import { FocusRules } from '@rlrpg/shared/rules'

export class FocusLogic {
  static completedIntervals(
    focusedSeconds: number,
    intervalMinutes: number,
  ): number {
    return FocusRules.completedIntervals(focusedSeconds, intervalMinutes)
  }

  static xpForRoll(roll: number, settings: FocusSettings): number {
    return FocusRules.xpForRoll(roll, settings)
  }

  static totalXp(rolls: number[], settings: FocusSettings): number {
    return FocusRules.totalXp(rolls, settings)
  }
}
