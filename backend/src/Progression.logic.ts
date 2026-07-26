import { ProgressionRules } from '@rlrpg/shared/rules'

export interface Progression {
  level: number
  levelXp: number
  nextLevelXp: number
}

export class ProgressionLogic {
  static costForLevel(level: number): number {
    return ProgressionRules.costForLevel(level)
  }

  static fromTotalXp(totalXp: number): Progression {
    return ProgressionRules.fromTotalXp(totalXp)
  }

  static totalXpForLevel(level: number): number {
    let totalXp = 0
    for (let currentLevel = 1; currentLevel < level; currentLevel += 1) {
      totalXp += this.costForLevel(currentLevel)
    }
    return totalXp
  }
}
