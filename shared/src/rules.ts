import type { FocusSettings } from './contracts.js'

export class FocusRules {
  static completedIntervals(
    focusedSeconds: number,
    intervalMinutes: number,
  ): number {
    return Math.floor(focusedSeconds / (intervalMinutes * 60))
  }

  static xpForRoll(roll: number, settings: FocusSettings): number {
    const bonusPercent =
      roll === 1
        ? settings.naturalOneBonusPercent
        : roll === 20
          ? settings.naturalTwentyBonusPercent
          : roll * settings.normalPercentPerPip
    return settings.baseXp + Math.floor((settings.baseXp * bonusPercent) / 100)
  }

  static totalXp(rolls: number[], settings: FocusSettings): number {
    return rolls.reduce(
      (total, roll) => total + this.xpForRoll(roll, settings),
      0,
    )
  }
}
