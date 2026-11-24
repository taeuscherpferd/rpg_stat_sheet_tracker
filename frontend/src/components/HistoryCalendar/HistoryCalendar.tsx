import { useState, type ComponentProps } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { SkillResponse, XpEntryResponse } from '@rlrpg/shared/contracts'
import { AppLogic } from '@/components/App/App.logic'
import { HistoryList } from '@/components/Settings/HistoryList'
import { HistoryCalendarLogic } from '@/components/HistoryCalendar/HistoryCalendar.logic'
import { HistoryDayDetails } from '@/components/HistoryDayDetails/HistoryDayDetails'
import { StreakBadge } from '@/components/StreakBadge/StreakBadge'
import styles from './HistoryCalendar.module.scss'

type HistoryCalendarProps = ComponentProps<typeof HistoryList> & {
  skills?: SkillResponse[]
  streakEntries?: XpEntryResponse[]
}

export const HistoryCalendar = ({
  skills = [],
  streakEntries,
  ...props
}: HistoryCalendarProps) => {
  const today = AppLogic.today()
  const [month, setMonth] = useState(today.slice(0, 7))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const summaries = HistoryCalendarLogic.summarize(props.entries, props.skillId)
  const streaks = HistoryCalendarLogic.streaks(
    streakEntries ?? props.entries,
    today,
    props.skillId,
  )
  const monthLabel = HistoryCalendarLogic.label(`${month}-01`, 'month')
  const showMonth = (nextMonth: string) => {
    setMonth(nextMonth)
    setSelectedDate(null)
  }

  if (selectedDate !== null)
    return (
      <HistoryDayDetails
        {...props}
        entries={summaries[selectedDate]?.entries ?? []}
        date={selectedDate}
        skills={skills}
        streakCount={streaks.byDate[selectedDate] ?? 0}
        onBack={() => setSelectedDate(null)}
        onChangeDate={(date) => {
          setSelectedDate(date)
          setMonth(date.slice(0, 7))
        }}
      />
    )

  return (
    <section className={styles.calendar} aria-label="History calendar">
      <header className={styles.header}>
        <h3 aria-live="polite">{monthLabel}</h3>
        <div className={styles.navigation}>
          <button
            type="button"
            aria-label="Previous month"
            onClick={() =>
              showMonth(HistoryCalendarLogic.shiftMonth(month, -1))
            }
          >
            <ChevronLeft size={18} />
          </button>
          <button type="button" onClick={() => showMonth(today.slice(0, 7))}>
            Today
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => showMonth(HistoryCalendarLogic.shiftMonth(month, 1))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </header>
      <div
        className={styles.streakOverview}
        role="group"
        aria-label="Calendar streaks"
      >
        <div>
          <StreakBadge count={streaks.current} />
          <span>Current streak</span>
        </div>
        <div>
          <StreakBadge count={streaks.best} />
          <span>Best streak</span>
        </div>
      </div>
      <p className={styles.streakHint}>
        Marked streak days count once each.{' '}
        {props.skillId ? 'For this skill.' : 'Across all skills.'} Date and
        source filters do not change streaks.
      </p>
      <label className={styles.monthPicker}>
        Jump to month
        <input
          type="month"
          value={month}
          onChange={(event) => {
            if (
              event.target.validity.valid &&
              /^\d{4}-\d{2}$/.test(event.target.value)
            )
              showMonth(event.target.value)
          }}
        />
      </label>
      <p className={styles.hint}>
        Select a day to see its entries. Your history filters apply here too.
      </p>
      <div className={styles.weekdays} aria-hidden="true">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div
        className={styles.days}
        role="group"
        aria-label={`${monthLabel} calendar`}
      >
        {HistoryCalendarLogic.days(month).map((day) => {
          const summary = summaries[day.date]
          const count = summary?.entries.length ?? 0
          const xp = summary?.xp ?? 0
          const streakCount = streaks.byDate[day.date] ?? 0
          const daySkills = HistoryCalendarLogic.daySkills(
            summary?.entries ?? [],
            skills,
            props.skillId,
          )
          return (
            <button
              key={day.date}
              type="button"
              className={`${styles.day} ${day.inMonth ? '' : styles.outside} ${count > 0 ? styles.hasEntries : ''}`}
              aria-label={`${HistoryCalendarLogic.label(day.date, 'day')}: ${count} ${count === 1 ? 'entry' : 'entries'}, ${xp.toLocaleString()} XP${daySkills.length > 0 ? `, ${daySkills.map((skill) => `${skill.emoji} ${skill.name}`).join(', ')}` : ''}${streakCount > 0 ? `, streak day ${streakCount}` : ''}`}
              aria-current={day.date === today ? 'date' : undefined}
              onClick={() => {
                setSelectedDate(day.date)
                setMonth(day.date.slice(0, 7))
              }}
            >
              <span className={styles.dayHeading}>
                <span className={styles.dayNumber}>{day.day}</span>
                {streakCount > 0 && <StreakBadge count={streakCount} compact />}
              </span>
              {count > 0 && (
                <>
                  <strong>
                    {xp.toLocaleString()}{' '}
                    <span className={styles.xpLabel}>XP</span>
                  </strong>
                  <small>
                    {count}{' '}
                    <span className={styles.entryLabel}>
                      {count === 1 ? 'entry' : 'entries'}
                    </span>
                  </small>
                </>
              )}
              <span className={styles.daySkills}>
                {daySkills.slice(0, 2).map((skill) => (
                  <span
                    className={styles.skillChip}
                    key={skill.id}
                    title={`${skill.emoji} ${skill.name}`}
                  >
                    <span className={styles.skillEmoji}>{skill.emoji}</span>
                    <span className={styles.skillName}>{skill.name}</span>
                  </span>
                ))}
                {daySkills.length > 2 && (
                  <small>+{daySkills.length - 2} more</small>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
