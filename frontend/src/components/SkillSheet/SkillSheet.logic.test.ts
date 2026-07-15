import { describe, expect, it } from 'vitest'
import type { SkillResponse } from '@rlrpg/shared/contracts'
import { SkillSheetLogic } from './SkillSheet.logic'

const makeSkill = (
  name: string,
  code: string,
  level: number,
): SkillResponse => ({
  id: code,
  name,
  code,
  emoji: null,
  tags: code === 'WCR' ? ['craft', 'wood'] : [],
  headerColor: '#334b3f',
  archived: false,
  totalXp: 0,
  level,
  levelXp: 0,
  nextLevelXp: 100,
  links: [],
})

const skills = [
  makeSkill('Wood Carving', 'WCR', 3),
  makeSkill('Alchemy', 'ALC', 5),
  makeSkill('Archery', 'ARC', 5),
]

describe('SkillSheetLogic', () => {
  it('filters skill names and codes without matching case or surrounding space', () => {
    expect(
      SkillSheetLogic.filterAndSort(skills, '  CARV  ', 'name').map(
        (skill) => skill.code,
      ),
    ).toEqual(['WCR'])
    expect(
      SkillSheetLogic.filterAndSort(skills, 'alc', 'name').map(
        (skill) => skill.code,
      ),
    ).toEqual(['ALC'])
  })

  it('filters skills by tag', () => {
    expect(
      SkillSheetLogic.filterAndSort(skills, 'craft', 'name').map(
        (skill) => skill.code,
      ),
    ).toEqual(['WCR'])
  })

  it('sorts by name without changing the source array', () => {
    expect(
      SkillSheetLogic.filterAndSort(skills, '', 'name').map(
        (skill) => skill.name,
      ),
    ).toEqual(['Alchemy', 'Archery', 'Wood Carving'])
    expect(skills[0]?.name).toBe('Wood Carving')
  })

  it('sorts by descending level and uses name to break ties', () => {
    expect(
      SkillSheetLogic.filterAndSort(skills, '', 'level').map(
        (skill) => skill.name,
      ),
    ).toEqual(['Alchemy', 'Archery', 'Wood Carving'])
  })
})
