import { useEffect, useState } from 'react'
import {
  XpCelebrationLogic,
  type XpCelebrationEvent,
  type XpProgressStage,
} from '@/components/XpCelebration/XpCelebration.logic'

type AnimatedProgressBySkillId = Partial<Record<string, XpProgressStage>>

interface XpAwardAnimation {
  progressBySkillId: AnimatedProgressBySkillId
  readyForCelebration: boolean
}

export const useXpAwardAnimation = (
  event: XpCelebrationEvent | null,
): XpAwardAnimation => {
  const [progressBySkillId, setProgressBySkillId] =
    useState<AnimatedProgressBySkillId>({})
  const [readyForCelebration, setReadyForCelebration] = useState(false)

  useEffect(() => {
    const timers: number[] = []

    if (event === null) {
      timers.push(
        window.setTimeout(() => {
          setProgressBySkillId({})
          setReadyForCelebration(false)
        }),
      )
      return () => {
        timers.forEach((timer) => window.clearTimeout(timer))
      }
    }

    const timelines = event.awards.map((award) => ({
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
          setProgressBySkillId(finalProgress)
          setReadyForCelebration(true)
        }),
      )
      return () => {
        timers.forEach((timer) => window.clearTimeout(timer))
      }
    }

    timers.push(
      window.setTimeout(() => {
        setReadyForCelebration(false)
        setProgressBySkillId(
          Object.fromEntries(
            timelines.map(({ award, stages }) => [
              award.skillId,
              stages[0] ?? {
                ...award.previous,
                animate: false,
                atMs: 0,
                fillPercent: 0,
                transitionMs: 0,
              },
            ]),
          ) as AnimatedProgressBySkillId,
        )
      }),
    )

    for (const { award, stages } of timelines) {
      for (const stage of stages.slice(1)) {
        timers.push(
          window.setTimeout(() => {
            setProgressBySkillId((current) => ({
              ...current,
              [award.skillId]: stage,
            }))
          }, stage.atMs),
        )
      }
    }

    const duration = Math.max(
      0,
      ...event.awards.map((award) =>
        XpCelebrationLogic.animationDuration(award),
      ),
    )
    timers.push(window.setTimeout(() => setReadyForCelebration(true), duration))

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [event])

  return { progressBySkillId, readyForCelebration }
}
