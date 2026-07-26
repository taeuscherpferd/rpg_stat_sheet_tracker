import type { FocusSettings } from './contracts.js'

export const DEFAULT_MAXIMUM_MANUAL_XP = 2000
export const MAXIMUM_MANUAL_XP = 1_000_000

export class ProgressionRules {
  static costForLevel(level: number): number {
    if (level === 1) return 300
    if (level === 2) return 700
    if (level === 3) return 1500
    if (level < 100) return 2500
    if (level < 151) return 5000
    if (level < 201) return 7500
    if (level < 300) return 15000
    if (level < 400) return 30000
    if (level < 500) return 50000
    return 100000
  }

  static fromTotalXp(totalXp: number): {
    level: number
    levelXp: number
    nextLevelXp: number
  } {
    let level = 1
    let remaining = Math.max(0, totalXp)
    let cost = this.costForLevel(level)

    while (remaining >= cost) {
      remaining -= cost
      level += 1
      cost = this.costForLevel(level)
    }

    return { level, levelXp: remaining, nextLevelXp: cost }
  }
}

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
