import { describe, expect, it } from 'vitest'
import { ProgressionLogic } from './Progression.logic.js'

describe('ProgressionLogic', () => {
  it.each([
    [1, 300],
    [2, 700],
    [3, 1500],
    [4, 2500],
    [99, 2500],
    [100, 5000],
    [150, 5000],
    [151, 7500],
    [200, 7500],
    [201, 15000],
    [299, 15000],
    [300, 30000],
    [399, 30000],
    [400, 50000],
    [499, 50000],
    [500, 100000],
  ])('uses the configured cost at level %i', (level, cost) => {
    expect(ProgressionLogic.costForLevel(level)).toBe(cost)
  })

  it('carries XP across multiple levels', () => {
    expect(ProgressionLogic.fromTotalXp(1000)).toEqual({
      level: 3,
      levelXp: 0,
      nextLevelXp: 1500,
    })
    expect(ProgressionLogic.fromTotalXp(-10)).toEqual({
      level: 1,
      levelXp: 0,
      nextLevelXp: 300,
    })
  })

  it('converts an imported level to its exact starting XP', () => {
    expect(ProgressionLogic.totalXpForLevel(1)).toBe(0)
    expect(ProgressionLogic.totalXpForLevel(4)).toBe(2500)
    expect(
      ProgressionLogic.fromTotalXp(ProgressionLogic.totalXpForLevel(42)),
    ).toEqual({ level: 42, levelXp: 0, nextLevelXp: 2500 })
  })
})
