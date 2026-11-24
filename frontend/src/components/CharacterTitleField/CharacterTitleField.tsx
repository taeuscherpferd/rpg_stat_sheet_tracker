import { useId } from 'react'
import type { AchievementResponse } from '@rlrpg/shared/contracts'
import styles from './CharacterTitleField.module.scss'

type CharacterTitleFieldProps = {
  achievements: AchievementResponse[]
  value: string
  onChange: (achievementId: string) => void
}

export const CharacterTitleField = ({
  achievements,
  value,
  onChange,
}: CharacterTitleFieldProps) => {
  const hintId = useId()
  return (
    <div className={styles.field}>
      <label>
        <span>Character title</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={hintId}
        >
          <option value="">No title</option>
          {achievements.map((achievement) => (
            <option
              key={achievement.id}
              value={achievement.id}
              disabled={!achievement.earnedEntryId}
            >
              {achievement.name}
              {achievement.earnedEntryId ? '' : ' (Locked)'}
            </option>
          ))}
        </select>
      </label>
      <p id={hintId} className={styles.hint}>
        Complete achievements on the Skills page to unlock their titles.
      </p>
    </div>
  )
}
