import type { SkillLinkResponse, SkillResponse } from '@rlrpg/shared/contracts'
import type {
  SkillXpAwardPresentation,
  XpProgressStage,
} from '@/components/XpCelebration/XpCelebration.logic'

export type SkillCardProgress = Pick<
  SkillResponse,
  'level' | 'levelXp' | 'nextLevelXp'
>

export class SkillCardLogic {
  static displayedProgress(
    skill: SkillResponse,
    animatedProgress?: XpProgressStage,
    awardedXp?: SkillXpAwardPresentation,
  ): SkillCardProgress {
    return animatedProgress ?? awardedXp?.previous ?? skill
  }

  static progressPercent(progress: SkillCardProgress): number {
    if (progress.nextLevelXp <= 0) return 0

    return Math.min(100, (progress.levelXp / progress.nextLevelXp) * 100)
  }

  static linksTitle(links: SkillLinkResponse[]): string {
    return links
      .map((link) => `${link.targetSkillName} ${link.percentage}%`)
      .join(', ')
  }
}
