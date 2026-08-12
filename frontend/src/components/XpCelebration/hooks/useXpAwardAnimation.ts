import { useEffect, useMemo, useState } from 'react'
import {
  XpCelebrationLogic,
  type XpAwardPresentation,
  type XpProgressStage,
} from '@/components/XpCelebration/XpCelebration.logic'

type AnimatedProgressBySkillId = Partial<Record<string, XpProgressStage>>

interface XpAwardAnimation {
  progressBySkillId: AnimatedProgressBySkillId
  readyForCelebration: boolean
}

interface XpAwardAnimationState extends XpAwardAnimation {
  presentation: XpAwardPresentation | null
}

const initialProgress = (
  presentation: XpAwardPresentation | null,
): AnimatedProgressBySkillId =>
  presentation === null
    ? {}
    : Object.fromEntries(
        presentation.awards.map((award) => {
          const firstStage = XpCelebrationLogic.progressStages(award)[0]
          return [
            award.skillId,
            firstStage ?? {
              ...award.previous,
              animate: false,
              atMs: 0,
              fillPercent: 0,
              transitionMs: 0,
            },
          ]
        }),
      )

export const useXpAwardAnimation = (
  presentation: XpAwardPresentation | null,
): XpAwardAnimation => {
  const startingProgress = useMemo(
    () => initialProgress(presentation),
    [presentation],
  )
  const [animation, setAnimation] = useState<XpAwardAnimationState>(() => ({
    presentation,
    progressBySkillId: startingProgress,
    readyForCelebration: false,
  }))
  const currentAnimation =
    animation.presentation === presentation
      ? animation
      : {
          presentation,
          progressBySkillId: startingProgress,
          readyForCelebration: false,
        }

  useEffect(() => {
    const timers: number[] = []

    if (presentation === null) {
      timers.push(
        window.setTimeout(() => {
          setAnimation({
            presentation: null,
            progressBySkillId: {},
            readyForCelebration: false,
          })
        }),
      )
      return () => {
        timers.forEach((timer) => window.clearTimeout(timer))
      }
    }

    const timelines = presentation.awards.map((award) => ({
      award,
      stages: XpCelebrationLogic.progressStages(award),
    }))
    const finalProgress = Object.fromEntries(
      timelines.map(({ award, stages }) => [
        award.skillId,
        stages.at(-1) ?? {
          ...award.current,
          animate: false,
          atMs: 0,
          fillPercent: 0,
          transitionMs: 0,
        },
      ]),
    ) as AnimatedProgressBySkillId
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    if (reduceMotion) {
      timers.push(
        window.setTimeout(() => {
          setAnimation({
            presentation,
            progressBySkillId: finalProgress,
            readyForCelebration: true,
          })
        }),
      )
      return () => {
        timers.forEach((timer) => window.clearTimeout(timer))
      }
    }

    for (const { award, stages } of timelines) {
      for (const stage of stages.slice(1)) {
        timers.push(
          window.setTimeout(() => {
            setAnimation((current) => ({
              presentation,
              progressBySkillId: {
                ...(current.presentation === presentation
                  ? current.progressBySkillId
                  : startingProgress),
                [award.skillId]: stage,
              },
              readyForCelebration: false,
            }))
          }, stage.atMs),
        )
      }
    }

    const duration = Math.max(
      0,
      ...presentation.awards.map((award) =>
        XpCelebrationLogic.animationDuration(award),
      ),
    )
    timers.push(
      window.setTimeout(() => {
        setAnimation((current) => ({
          presentation,
          progressBySkillId:
            current.presentation === presentation
              ? current.progressBySkillId
              : finalProgress,
          readyForCelebration: true,
        }))
      }, duration),
    )

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [presentation, startingProgress])

  return currentAnimation
}
