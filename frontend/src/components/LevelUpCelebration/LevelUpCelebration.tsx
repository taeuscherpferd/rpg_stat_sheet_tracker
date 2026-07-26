import { useState } from 'react'
import { ArrowRight, Sparkles, Trophy } from 'lucide-react'
import { Modal } from '@/components/Modal/Modal'
import type { SkillXpAwardPresentation } from '@/components/XpCelebration/XpCelebration.logic'
import styles from './LevelUpCelebration.module.scss'

interface LevelUpCelebrationProps {
  awards: SkillXpAwardPresentation[]
  onComplete: () => void
}

export const LevelUpCelebration = ({
  awards,
  onComplete,
}: LevelUpCelebrationProps) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const award = awards[currentIndex]

  if (award === undefined) return null

  const continueCelebration = () => {
    if (currentIndex < awards.length - 1) {
      setCurrentIndex(currentIndex + 1)
      return
    }
    onComplete()
  }

  const gainedLevels = award.current.level - award.previous.level
  const hasAnotherLevelUp = currentIndex < awards.length - 1

  return (
    <Modal
      title={`Level up · ${award.skillName}`}
      onClose={continueCelebration}
    >
      <div className={styles.celebration} aria-live="polite">
        <div className={styles.confetti} aria-hidden="true">
          {Array.from({ length: 18 }, (_, index) => (
            <i key={index} />
          ))}
        </div>
        <div className={styles.emblem} aria-hidden="true">
          <Sparkles size={22} />
          <span>{award.emoji ?? <Trophy size={42} />}</span>
          <Sparkles size={22} />
        </div>
        <p className={styles.kicker}>A new rank has been earned</p>
        <h3>{award.skillName}</h3>
        <div className={styles.levels}>
          <span>
            Former level
            <strong>{award.previous.level}</strong>
          </span>
          <ArrowRight size={26} aria-label="advanced to" />
          <span className={styles.newLevel}>
            New level
            <strong>{award.current.level}</strong>
          </span>
        </div>
        <p className={styles.summary}>
          +{award.amount.toLocaleString()} XP
          {gainedLevels > 1
            ? ` carried you across ${gainedLevels} levels.`
            : ''}
        </p>
        <button type="button" onClick={continueCelebration}>
          <Sparkles size={17} />
          {hasAnotherLevelUp ? 'Next level up' : 'Return to the ledger'}
        </button>
      </div>
    </Modal>
  )
}
