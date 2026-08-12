import type { SkillResponse, XpAwardResponse } from '@rlrpg/shared/contracts'
import { ProgressionRules } from '@rlrpg/shared/rules'

export interface XpProgressSnapshot {
  level: number
  levelXp: number
  nextLevelXp: number
}

export interface SkillXpAwardPresentation {
  skillId: string
  skillName: string
  emoji: string | null
  amount: number
  previous: XpProgressSnapshot
  current: XpProgressSnapshot
}

export interface XpAwardPresentation {
  awards: SkillXpAwardPresentation[]
}

export interface XpCelebrationEvent extends XpAwardPresentation {
  id: number
  userId: string
}

export interface XpProgressStage extends XpProgressSnapshot {
  animate: boolean
  atMs: number
  fillPercent: number
  transitionMs: number
}

export class XpCelebrationLogic {
  static readonly progressTransitionMs = 1_600
  static readonly progressResetDelayMs = 250
  static readonly maximumTimelineMs = 24_000

  static createPresentation(
    currentSkills: SkillResponse[],
    awards: XpAwardResponse[],
  ): XpAwardPresentation {
    const currentById = new Map(currentSkills.map((skill) => [skill.id, skill]))

    return {
      awards: awards.flatMap((award) => {
        const current = currentById.get(award.skillId)
        if (current === undefined || award.amount < 1) return []

        return [
          {
            skillId: award.skillId,
            skillName: award.skillName,
            emoji: current.emoji,
            amount: award.amount,
            previous: ProgressionRules.fromTotalXp(
              current.totalXp - award.amount,
            ),
            current: this.progressSnapshot(current),
          },
        ]
      }),
    }
  }

  static progressStages(award: SkillXpAwardPresentation): XpProgressStage[] {
    const { transitionMs, resetDelayMs } = this.animationTiming(award)
    const stages: XpProgressStage[] = [
      {
        ...award.previous,
        animate: false,
        atMs: 0,
        fillPercent: this.progressPercent(award.previous),
        transitionMs: 0,
      },
    ]
    let atMs = resetDelayMs

    for (
      let level = award.previous.level;
      level < award.current.level;
      level += 1
    ) {
      const levelCost = ProgressionRules.costForLevel(level)
      stages.push({
        level,
        levelXp: levelCost,
        nextLevelXp: levelCost,
        animate: true,
        atMs,
        fillPercent: 100,
        transitionMs,
      })
      atMs += transitionMs
      const nextLevel = level + 1
      stages.push({
        level: nextLevel,
        levelXp: 0,
        nextLevelXp: ProgressionRules.costForLevel(nextLevel),
        animate: false,
        atMs,
        fillPercent: 0,
        transitionMs: 0,
      })
      atMs += resetDelayMs
    }

    stages.push({
      ...award.current,
      animate: award.current.levelXp > 0,
      atMs,
      fillPercent: this.progressPercent(award.current),
      transitionMs: award.current.levelXp > 0 ? transitionMs : 0,
    })
    return stages
  }

  static animationDuration(award: SkillXpAwardPresentation): number {
    const finalStage = this.progressStages(award).at(-1)
    if (finalStage === undefined) return 0
    return (
      finalStage.atMs + (finalStage.animate ? finalStage.transitionMs : 250)
    )
  }

  static levelUps(
    presentation: XpAwardPresentation,
  ): SkillXpAwardPresentation[] {
    return presentation.awards.filter(
      (award) => award.current.level > award.previous.level,
    )
  }

  private static progressSnapshot(skill: SkillResponse): XpProgressSnapshot {
    return {
      level: skill.level,
      levelXp: skill.levelXp,
      nextLevelXp: skill.nextLevelXp,
    }
  }

  private static progressPercent(progress: XpProgressSnapshot): number {
    if (progress.nextLevelXp <= 0) return 0
    return Math.min(100, (progress.levelXp / progress.nextLevelXp) * 100)
  }

  private static animationTiming(award: SkillXpAwardPresentation): {
    transitionMs: number
    resetDelayMs: number
  } {
    const crossedLevels = Math.max(
      0,
      award.current.level - award.previous.level,
    )
    const budgetedStageMs = Math.max(
      16,
      Math.floor(this.maximumTimelineMs / (crossedLevels * 2 + 1)),
    )

    return {
      transitionMs: Math.min(this.progressTransitionMs, budgetedStageMs),
      resetDelayMs: Math.min(this.progressResetDelayMs, budgetedStageMs),
    }
  }
}
