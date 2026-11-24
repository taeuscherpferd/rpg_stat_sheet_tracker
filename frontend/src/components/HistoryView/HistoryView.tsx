import { useState, type ComponentProps } from 'react'
import { CalendarDays, List } from 'lucide-react'
import type { SkillResponse, XpEntryResponse } from '@rlrpg/shared/contracts'
import { HistoryList } from '@/components/Settings/HistoryList'
import { HistoryCalendar } from '@/components/HistoryCalendar/HistoryCalendar'
import styles from './HistoryView.module.scss'

type HistoryViewProps = ComponentProps<typeof HistoryList> & {
  skills?: SkillResponse[]
  streakEntries?: XpEntryResponse[]
}

export const HistoryView = ({
  skills = [],
  streakEntries,
  ...props
}: HistoryViewProps) => {
  const [view, setView] = useState<'list' | 'calendar'>('list')
  return (
    <div>
      <div className={styles.switcher} role="group" aria-label="History view">
        <button
          type="button"
          aria-pressed={view === 'list'}
          onClick={() => setView('list')}
        >
          <List size={16} /> List
        </button>
        <button
          type="button"
          aria-pressed={view === 'calendar'}
          onClick={() => setView('calendar')}
        >
          <CalendarDays size={16} /> Calendar
        </button>
      </div>
      {view === 'list' ? (
        <HistoryList {...props} />
      ) : (
        <HistoryCalendar
          {...props}
          skills={skills}
          streakEntries={streakEntries}
        />
      )}
    </div>
  )
}
