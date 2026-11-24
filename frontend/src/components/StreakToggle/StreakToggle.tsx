import { Flame } from 'lucide-react'
import styles from './StreakToggle.module.scss'

type StreakToggleProps = {
  pressed: boolean
  count: number
  currentCount: number
  disabled?: boolean
  onChange: (pressed: boolean) => void
}

export const StreakToggle = ({
  pressed,
  count,
  currentCount,
  disabled = false,
  onChange,
}: StreakToggleProps) => (
  <button
    className={styles.toggle}
    type="button"
    disabled={disabled}
    aria-pressed={pressed}
    aria-label="Count this XP entry toward the skill streak"
    onClick={() => onChange(!pressed)}
  >
    <span className={styles.box} aria-hidden="true">
      {pressed && '✓'}
    </span>
    <span>Streak</span>
    {pressed ? (
      <span className={styles.count}>
        <Flame size={18} aria-hidden="true" /> {count}
      </span>
    ) : (
      <span className={styles.current}>{currentCount} day streak</span>
    )}
  </button>
)
