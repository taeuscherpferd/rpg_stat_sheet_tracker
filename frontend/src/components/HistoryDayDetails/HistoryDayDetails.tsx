import { useEffect, useId, useRef, type ComponentProps } from 'react'
import type { SkillResponse } from '@rlrpg/shared/contracts'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { HistoryList } from '@/components/Settings/HistoryList'
import { HistoryCalendarLogic } from '@/components/HistoryCalendar/HistoryCalendar.logic'
import { StreakBadge } from '@/components/StreakBadge/StreakBadge'
import styles from './HistoryDayDetails.module.scss'

type HistoryDayDetailsProps = ComponentProps<typeof HistoryList> & {
  date: string
  skills: SkillResponse[]
  streakCount?: number
  onBack: () => void
  onChangeDate: (date: string) => void
}

export const HistoryDayDetails = ({
  date,
  skills,
  streakCount = 0,
  onBack,
  onChangeDate,
  ...props
}: HistoryDayDetailsProps) => {
  const headingId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const xp = props.entries.reduce(
    (sum, entry) => sum + HistoryCalendarLogic.entryXp(entry, props.skillId),
    0,
  )
  const daySkills = HistoryCalendarLogic.daySkills(
    props.entries,
    skills,
    props.skillId,
  )
  useEffect(() => {
    sectionRef.current?.scrollIntoView?.({ block: 'start' })
    headingRef.current?.focus({ preventScroll: true })
  }, [date])

  return (
    <section
      ref={sectionRef}
      className={styles.dayDetails}
      aria-labelledby={headingId}
    >
      <div className={styles.toolbar}>
        <button type="button" onClick={onBack}>
          <ArrowLeft size={16} /> Back to calendar
        </button>
        <div>
          <button
            type="button"
            aria-label="Previous day"
            onClick={() =>
              onChangeDate(HistoryCalendarLogic.shiftDay(date, -1))
            }
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            aria-label="Next day"
            onClick={() => onChangeDate(HistoryCalendarLogic.shiftDay(date, 1))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <h3 id={headingId} ref={headingRef} tabIndex={-1}>
        {HistoryCalendarLogic.label(date, 'day')}
      </h3>
      <div className={styles.summary}>
        <span>
          <StreakBadge count={streakCount} /> day streak
        </span>
        <span>
          <strong>{xp.toLocaleString()}</strong> XP earned
        </span>
        <span>
          <strong>{props.entries.length}</strong>{' '}
          {props.entries.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>
      <div className={styles.skills}>
        {daySkills.map((skill) => (
          <span key={skill.id}>
            <span aria-hidden="true">{skill.emoji}</span> {skill.name}
          </span>
        ))}
      </div>
      {props.entries.length > 0 ? (
        <HistoryList {...props} expandedDetails />
      ) : (
        <p className={styles.empty}>
          No entries for this day match your filters.
        </p>
      )}
    </section>
  )
}
