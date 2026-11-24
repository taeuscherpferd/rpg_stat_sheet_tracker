import type { SkillResponse } from '@rlrpg/shared/contracts'
import {
  characterBackgrounds,
  startingBackgroundId,
} from '@/components/CharacterBackground/CharacterBackground.data'

export class CharacterBackgroundLogic {
  static totalXp(skills: Pick<SkillResponse, 'totalXp'>[]): number {
    return skills.reduce((sum, skill) => sum + Math.max(0, skill.totalXp), 0)
  }

  static isUnlocked(backgroundId: string, totalXp: number): boolean {
    return characterBackgrounds.some(
      (background) =>
        background.id === backgroundId &&
        Math.max(0, totalXp) >= background.requiredXp,
    )
  }

  static availableBackground(backgroundId: string, totalXp: number): string {
    return CharacterBackgroundLogic.isUnlocked(backgroundId, totalXp)
      ? backgroundId
      : startingBackgroundId
  }
}
