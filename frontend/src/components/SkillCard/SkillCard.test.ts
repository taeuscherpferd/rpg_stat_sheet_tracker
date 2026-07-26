import { describe, expect, it } from 'vitest'
import type { SkillResponse } from '@rlrpg/shared/contracts'
import type {
  SkillXpAwardPresentation,
  XpProgressStage,
} from '@/components/XpCelebration/XpCelebration.logic'
import { SkillCardLogic } from './SkillCard.logic'

const makeSkill = (): SkillResponse => ({
  id: 'skill-1',
  name: 'Alchemy',
  code: 'ALC',
  emoji: null,
  tags: [],
  headerColor: '#334b3f',
  archived: false,
  totalXp: 1_200,
  level: 4,
  levelXp: 80,
  nextLevelXp: 100,
  links: [
    {
      targetSkillId: 'skill-2',
      targetSkillName: 'Herbalism',
      percentage: 15,
    },
    {
      targetSkillId: 'skill-3',
      targetSkillName: 'Glasswork',
      percentage: 10,
    },
  ],
})

const makeAward = (): SkillXpAwardPresentation => ({
  skillId: 'skill-1',
  skillName: 'Alchemy',
  emoji: null,
  amount: 50,
  previous: {
    level: 4,
    levelXp: 80,
    nextLevelXp: 100,
  },
  current: {
    level: 5,
    levelXp: 30,
    nextLevelXp: 120,
  },
})

const makeAnimatedProgress = (): XpProgressStage => ({
  level: 5,
  levelXp: 30,
  nextLevelXp: 120,
  animate: true,
  atMs: 700,
  fillPercent: 25,
  transitionMs: 700,
})

describe('displayedProgress', () => {
  it('should prefer animated progress when available', () => {
    const skill = makeSkill()
    const animatedProgress = makeAnimatedProgress()

    expect(
      SkillCardLogic.displayedProgress(skill, animatedProgress, makeAward()),
    ).toEqual(animatedProgress)
  })

  it('should use the award previous snapshot when no animation is active', () => {
    const skill = makeSkill()
    const award = makeAward()

    expect(SkillCardLogic.displayedProgress(skill, undefined, award)).toEqual(
      award.previous,
    )
  })

  it('should fall back to the live skill progress without award data', () => {
    const skill = makeSkill()

    expect(SkillCardLogic.displayedProgress(skill)).toBe(skill)
  })
})

describe('progressPercent', () => {
  it('should convert progress to a capped percentage', () => {
    expect(
      SkillCardLogic.progressPercent({
        level: 3,
        levelXp: 45,
        nextLevelXp: 60,
      }),
    ).toBe(75)

    expect(
      SkillCardLogic.progressPercent({
        level: 3,
        levelXp: 120,
        nextLevelXp: 100,
      }),
    ).toBe(100)
  })

  it('should return zero when the next level requirement is invalid', () => {
    expect(
      SkillCardLogic.progressPercent({
        level: 3,
        levelXp: 50,
        nextLevelXp: 0,
      }),
    ).toBe(0)
  })
})

describe('linksTitle', () => {
  it('should format the linked skill tooltip text', () => {
    expect(SkillCardLogic.linksTitle(makeSkill().links)).toBe(
      'Herbalism 15%, Glasswork 10%',
    )
  })

  it('should return an empty string when there are no links', () => {
    expect(SkillCardLogic.linksTitle([])).toBe('')
  })
})
