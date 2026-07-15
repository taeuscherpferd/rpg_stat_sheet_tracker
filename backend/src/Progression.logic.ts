export interface Progression {
  level: number
  levelXp: number
  nextLevelXp: number
}

export class ProgressionLogic {
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

  static fromTotalXp(totalXp: number): Progression {
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

  static totalXpForLevel(level: number): number {
    let totalXp = 0
    for (let currentLevel = 1; currentLevel < level; currentLevel += 1) {
      totalXp += this.costForLevel(currentLevel)
    }
    return totalXp
  }
}
