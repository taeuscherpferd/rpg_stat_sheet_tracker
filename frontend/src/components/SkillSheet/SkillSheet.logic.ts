import type { SkillResponse } from '@rlrpg/shared/contracts'

export type SkillSort = 'name' | 'level'

export class SkillSheetLogic {
  static filterAndSort(
    skills: SkillResponse[],
    filter: string,
    sort: SkillSort,
  ): SkillResponse[] {
    const normalizedFilter = filter.trim().toLocaleLowerCase()
    const filteredSkills = skills.filter((skill) => {
      const searchableText =
        `${skill.name} ${skill.code} ${skill.tags.join(' ')}`.toLocaleLowerCase()
      return searchableText.includes(normalizedFilter)
    })

    return filteredSkills.toSorted((firstSkill, secondSkill) => {
      const nameComparison = firstSkill.name.localeCompare(secondSkill.name)
      return sort === 'level'
        ? secondSkill.level - firstSkill.level || nameComparison
        : nameComparison
    })
  }
}
