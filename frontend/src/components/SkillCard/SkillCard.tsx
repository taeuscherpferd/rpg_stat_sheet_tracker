import {
  type SkillXpAwardPresentation,
  type XpProgressStage,
} from '@/components/XpCelebration/XpCelebration.logic'
import type { SkillResponse } from '@rlrpg/shared/contracts'
import { Link2, Pencil } from 'lucide-react'
import type { CSSProperties } from 'react'
import { SkillCardLogic } from './SkillCard.logic'
import styles from './SkillCard.module.scss'

type SkillCardStyle = CSSProperties & {
  '--skill-color': string
  '--skill-progress': string
  '--skill-progress-duration': string
}

interface SkillCardProps {
  skill: SkillResponse
  animatedProgress?: XpProgressStage
  awardedXp?: SkillXpAwardPresentation
  offline: boolean
  onEdit: (skill: SkillResponse) => void
  onLogXp: (skill: SkillResponse) => void
}

export const SkillCard = ({
  skill,
  animatedProgress,
  awardedXp,
  offline,
  onEdit,
  onLogXp,
}: SkillCardProps) => {
  const displayedProgress = SkillCardLogic.displayedProgress(
    skill,
    animatedProgress,
    awardedXp,
  )
  const progressPercent =
    animatedProgress?.fillPercent ??
    SkillCardLogic.progressPercent(displayedProgress)

  return (
    <article
      className={`${styles.skill} ${awardedXp === undefined ? '' : styles.skillAwarded}`}
      style={
        {
          '--skill-color': skill.headerColor,
          '--skill-progress': `${progressPercent}%`,
          '--skill-progress-duration': `${animatedProgress?.transitionMs ?? 0}ms`,
        } as SkillCardStyle
      }
    >
      <button
        className={styles.mainAction}
        type="button"
        disabled={offline}
        onClick={() => onLogXp(skill)}
      >
        <span className={styles.icon}>
          {skill.emoji ?? skill.code.slice(0, 1)}
        </span>
        <span className={styles.identity}>
          <strong>{skill.name}</strong>
          <small>{skill.code}</small>
        </span>
        <span className={styles.level}>
          Level <strong>{displayedProgress.level}</strong>
        </span>
        <span
          className={`${styles.progress} ${animatedProgress?.animate === true ? styles.progressAnimating : ''}`}
        >
          <span
            className={styles.track}
            role="progressbar"
            aria-label={`${skill.name} level progress`}
            aria-valuemin={0}
            aria-valuemax={displayedProgress.nextLevelXp}
            aria-valuenow={displayedProgress.levelXp}
          >
            <span className={styles.progressFill} />
          </span>
          {awardedXp !== undefined && (
            <small className={styles.xpGain}>
              +{awardedXp.amount.toLocaleString()} XP
            </small>
          )}
        </span>
        {skill.tags.length > 0 && (
          <span className={styles.tags}>
            {skill.tags.map((tag) => (
              <small key={tag}>{tag}</small>
            ))}
          </span>
        )}
      </button>
      <div className={styles.actions}>
        <button
          type="button"
          title="Edit skill"
          disabled={offline}
          onClick={() => onEdit(skill)}
        >
          <Pencil size={17} />
        </button>
        {skill.links.length > 0 && (
          <span title={SkillCardLogic.linksTitle(skill.links)}>
            <Link2 size={16} /> {skill.links.length}
          </span>
        )}
        <small className={styles.xpCount}>
          {displayedProgress.levelXp.toLocaleString()} /{' '}
          {displayedProgress.nextLevelXp.toLocaleString()} XP
        </small>
      </div>
    </article>
  )
}
