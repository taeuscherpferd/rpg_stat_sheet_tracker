import { characterBackgrounds } from '@/components/CharacterBackground/CharacterBackground.data'
import { CharacterBackground } from '@/components/CharacterBackground/CharacterBackground'
import { CharacterBackgroundLogic } from '@/components/CharacterBackground/CharacterBackground.logic'
import styles from './CharacterAppearanceControls.module.scss'

type CharacterAppearanceControlsProps = {
  backgroundId: string
  totalXp: number
  onBackgroundChange: (backgroundId: string) => void
}

export const CharacterAppearanceControls = ({
  backgroundId,
  totalXp,
  onBackgroundChange,
}: CharacterAppearanceControlsProps) => {
  const selectedBackground = characterBackgrounds.find(
    (background) => background.id === backgroundId,
  )

  return (
    <div className={styles.controls}>
      <fieldset className={styles.backgroundPicker}>
        <legend className={styles.label}>Background</legend>
        <p className={styles.hint}>
          Total skill XP: <strong>{totalXp.toLocaleString()}</strong>
        </p>
        <div className={styles.backgroundOptions}>
          {characterBackgrounds.map((background) => (
            <button
              key={background.id}
              type="button"
              aria-label={background.name}
              disabled={
                !CharacterBackgroundLogic.isUnlocked(background.id, totalXp)
              }
              title={
                totalXp >= background.requiredXp
                  ? 'Select background'
                  : `${Math.max(0, background.requiredXp - totalXp).toLocaleString()} more XP to unlock`
              }
              className={styles.backgroundOption}
              aria-pressed={backgroundId === background.id}
              onClick={() => onBackgroundChange(background.id)}
            >
              <span className={styles.thumbnail}>
                <CharacterBackground backgroundId={background.id} />
              </span>
              <span className={styles.choiceName}>{background.name}</span>
              <span className={styles.unlockRequirement}>
                {background.requiredXp === 0
                  ? 'Starter · Unlocked'
                  : `${background.requiredXp.toLocaleString()} XP · ${totalXp >= background.requiredXp ? 'Unlocked' : 'Locked'}`}
              </span>
              {totalXp < background.requiredXp && (
                <progress
                  className={styles.unlockProgress}
                  value={totalXp}
                  max={background.requiredXp}
                  aria-label={`${background.name} unlock progress`}
                />
              )}
            </button>
          ))}
        </div>
        <p className={styles.hint} role="status">
          Selected background: {selectedBackground?.name ?? 'Greenwood Forest'}
        </p>
      </fieldset>
    </div>
  )
}
