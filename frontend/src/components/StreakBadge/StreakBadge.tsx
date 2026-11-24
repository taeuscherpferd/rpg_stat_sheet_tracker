import streakFlame from '@/assets/streak-flame.png'
import styles from './StreakBadge.module.scss'

type StreakBadgeProps = { count: number; compact?: boolean }

export const StreakBadge = ({ count, compact = false }: StreakBadgeProps) => (
  <span
    className={`${styles.badge} ${compact ? styles.compact : ''}`}
    role="img"
    aria-label={`${count} day streak`}
    title={`${count} day streak`}
  >
    <img src={streakFlame} alt="" />
    <span aria-hidden="true">{count}</span>
  </span>
)
