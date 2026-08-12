import { useState } from 'react'
import type { SkillResponse } from '@rlrpg/shared/contracts'
import { LevelUpCelebration } from '@/components/LevelUpCelebration/LevelUpCelebration'
import { Modal } from '@/components/Modal/Modal'
import { SkillCard } from '@/components/SkillCard/SkillCard'
import {
  XpCelebrationLogic,
  type XpAwardPresentation,
} from '@/components/XpCelebration/XpCelebration.logic'
import { useXpAwardAnimation } from '@/components/XpCelebration/hooks/useXpAwardAnimation'
import styles from './XpAwardModal.module.scss'

interface XpAwardModalProps {
  presentation: XpAwardPresentation
  skills: SkillResponse[]
  onClose: () => void
}

export const XpAwardModal = ({
  presentation,
  skills,
  onClose,
}: XpAwardModalProps) => {
  const [showLevelUps, setShowLevelUps] = useState(false)
  const { progressBySkillId } = useXpAwardAnimation(presentation)
  const levelUps = XpCelebrationLogic.levelUps(presentation)
  const awardedSkills = presentation.awards.flatMap((award) => {
    const skill = skills.find((candidate) => candidate.id === award.skillId)
    return skill === undefined ? [] : [{ skill, award }]
  })

  if (showLevelUps) {
    return <LevelUpCelebration awards={levelUps} onComplete={onClose} />
  }

  const dismiss = () => {
    if (levelUps.length > 0) {
      setShowLevelUps(true)
      return
    }
    onClose()
  }

  return (
    <Modal title="XP awarded" onClose={dismiss}>
      <div className={styles.awards} aria-live="polite">
        {awardedSkills.map(({ skill, award }) => (
          <SkillCard
            key={skill.id}
            skill={skill}
            animatedProgress={progressBySkillId[skill.id]}
            awardedXp={award}
          />
        ))}
      </div>
    </Modal>
  )
}
