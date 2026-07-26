import { describe, expect, it } from 'vitest'
import type { SkillResponse, XpAwardResponse } from '@rlrpg/shared/contracts'
import { ProgressionRules } from '@rlrpg/shared/rules'
import {
  XpCelebrationLogic,
  type SkillXpAwardPresentation,
} from '@/components/XpCelebration/XpCelebration.logic'

const makeSkill = (
  id: string,
  level: number,
  levelXp: number,
  nextLevelXp: number,
): SkillResponse => ({
  id,
  name: id === 'archery' ? 'Archery' : 'Agility',
  code: id === 'archery' ? 'ARC' : 'AGI',
  emoji: id === 'archery' ? '🏹' : null,
  tags: [],
  headerColor: '#334b3f',
  archived: false,
  totalXp:
    Array.from({ length: level - 1 }, (_, index) =>
      ProgressionRules.costForLevel(index + 1),
    ).reduce((total, cost) => total + cost, 0) + levelXp,
  level,
  levelXp,
  nextLevelXp,
  links: [],
})

const makeAward = (
  previous: SkillXpAwardPresentation['previous'],
  current: SkillXpAwardPresentation['current'],
): SkillXpAwardPresentation => ({
  skillId: 'archery',
  skillName: 'Archery',
  emoji: '🏹',
  amount: 800,
  previous,
  current,
})

describe('XpCelebrationLogic', () => {
  it('creates presentations for direct and linked awards', () => {
    const current = [
      makeSkill('archery', 3, 100, 1500),
      makeSkill('agility', 1, 180, 300),
    ]
    const awards: XpAwardResponse[] = [
      {
        skillId: 'archery',
        skillName: 'Archery',
        amount: 150,
        kind: 'direct',
        percentage: null,
      },
      {
        skillId: 'agility',
        skillName: 'Agility',
        amount: 80,
        kind: 'linked',
        percentage: 20,
      },
    ]

    expect(XpCelebrationLogic.createPresentation(current, awards)).toEqual({
      awards: [
        {
          skillId: 'archery',
          skillName: 'Archery',
          emoji: '🏹',
          amount: 150,
          previous: { level: 2, levelXp: 650, nextLevelXp: 700 },
          current: { level: 3, levelXp: 100, nextLevelXp: 1500 },
        },
        {
          skillId: 'agility',
          skillName: 'Agility',
          emoji: null,
          amount: 80,
          previous: { level: 1, levelXp: 100, nextLevelXp: 300 },
          current: { level: 1, levelXp: 180, nextLevelXp: 300 },
        },
      ],
    })
  })

  it('ignores awards without a matching current skill snapshot', () => {
    const award: XpAwardResponse = {
      skillId: 'missing',
      skillName: 'Missing',
      amount: 10,
      kind: 'direct',
      percentage: null,
    }

    expect(
      XpCelebrationLogic.createPresentation(
        [makeSkill('archery', 1, 0, 300)],
        [award],
      ),
    ).toEqual({ awards: [] })
  })

  it('animates an ordinary award from its previous to current progress', () => {
    const award = makeAward(
      { level: 2, levelXp: 100, nextLevelXp: 700 },
      { level: 2, levelXp: 300, nextLevelXp: 700 },
    )

    expect(XpCelebrationLogic.progressStages(award)).toEqual([
      {
        level: 2,
        levelXp: 100,
        nextLevelXp: 700,
        animate: false,
        atMs: 0,
        fillPercent: (100 / 700) * 100,
        transitionMs: 0,
      },
      {
        level: 2,
        levelXp: 300,
        nextLevelXp: 700,
        animate: true,
        atMs: 50,
        fillPercent: (300 / 700) * 100,
        transitionMs: 700,
      },
    ])
    expect(XpCelebrationLogic.animationDuration(award)).toBe(750)
  })

  it('fills and resets the bar for every crossed level', () => {
    const award = makeAward(
      { level: 2, levelXp: 650, nextLevelXp: 700 },
      { level: 4, levelXp: 25, nextLevelXp: 2500 },
    )

    expect(XpCelebrationLogic.progressStages(award)).toEqual([
      {
        level: 2,
        levelXp: 650,
        nextLevelXp: 700,
        animate: false,
        atMs: 0,
        fillPercent: (650 / 700) * 100,
        transitionMs: 0,
      },
      {
        level: 2,
        levelXp: 700,
        nextLevelXp: 700,
        animate: true,
        atMs: 50,
        fillPercent: 100,
        transitionMs: 700,
      },
      {
        level: 3,
        levelXp: 0,
        nextLevelXp: 1500,
        animate: false,
        atMs: 750,
        fillPercent: 0,
        transitionMs: 0,
      },
      {
        level: 3,
        levelXp: 1500,
        nextLevelXp: 1500,
        animate: true,
        atMs: 800,
        fillPercent: 100,
        transitionMs: 700,
      },
      {
        level: 4,
        levelXp: 0,
        nextLevelXp: 2500,
        animate: false,
        atMs: 1500,
        fillPercent: 0,
        transitionMs: 0,
      },
      {
        level: 4,
        levelXp: 25,
        nextLevelXp: 2500,
        animate: true,
        atMs: 1550,
        fillPercent: 1,
        transitionMs: 700,
      },
    ])
    expect(XpCelebrationLogic.levelUps({ awards: [award] })).toEqual([award])
  })

  it('keeps very large multi-level timelines bounded', () => {
    const award = makeAward(
      { level: 1, levelXp: 0, nextLevelXp: 300 },
      { level: 209, levelXp: 7500, nextLevelXp: 15000 },
    )
    const stages = XpCelebrationLogic.progressStages(award)

    expect(stages).toHaveLength(418)
    expect(stages.filter((stage) => stage.fillPercent === 100)).toHaveLength(
      208,
    )
    expect(XpCelebrationLogic.animationDuration(award)).toBeLessThanOrEqual(
      XpCelebrationLogic.maximumTimelineMs,
    )
  })
})
