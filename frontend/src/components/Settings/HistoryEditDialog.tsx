import { type FormEvent, useState } from 'react'
import type { XpEntryResponse } from '@rlrpg/shared/contracts'
import { DEFAULT_MAXIMUM_MANUAL_XP } from '@rlrpg/shared/rules'
import { Modal } from '@/components/Modal/Modal'
import { WholeNumberInput } from '@/components/WholeNumberInput/WholeNumberInput'
import { StreakToggle } from '@/components/StreakToggle/StreakToggle'
import { HistoryCalendarLogic } from '@/components/HistoryCalendar/HistoryCalendar.logic'
import { useAppDispatch, useAppSelector } from '@/hooks'
import { editXp, refreshData } from '@/store'
import styles from './HistoryEditDialog.module.scss'

interface HistoryEditDialogProps {
  entry: XpEntryResponse
  onClose: () => void
}

export const HistoryEditDialog = ({
  entry,
  onClose,
}: HistoryEditDialogProps) => {
  const dispatch = useAppDispatch()
  const { settings, connection, entries, skills } = useAppSelector(
    (state) => state.app,
  )
  const offline = connection === 'offline'
  const [date, setDate] = useState(entry.date)
  const [xp, setXp] = useState(String(entry.xp))
  const [minutes, setMinutes] = useState(
    entry.minutes === null ? '' : String(entry.minutes),
  )
  const [activity, setActivity] = useState(entry.activity ?? '')
  const [notes, setNotes] = useState(entry.notes ?? '')
  const [streak, setStreak] = useState(entry.streak === true)
  const streakPreview =
    streak && date
      ? (HistoryCalendarLogic.streaks(
          [
            ...entries.filter((candidate) => candidate.id !== entry.id),
            { ...entry, date, streak },
          ],
          date,
          entry.skillId,
        ).byDate[date] ?? 0)
      : 0
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    await dispatch(
      editXp({
        id: entry.id,
        date,
        xp: Number(xp),
        minutes: minutes === '' ? null : Number(minutes),
        activity: activity || null,
        notes: notes || null,
        streak,
      }),
    ).unwrap()
    await dispatch(refreshData())
    onClose()
  }
  return (
    <Modal title={`Edit entry · ${entry.skillName}`} onClose={onClose}>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <div>
          <label>
            Date
            <input
              required
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <label>
            XP
            <WholeNumberInput
              required
              min={1}
              max={settings?.maximumManualXp ?? DEFAULT_MAXIMUM_MANUAL_XP}
              value={xp}
              onValueChange={setXp}
            />
          </label>
        </div>
        <StreakToggle
          pressed={streak}
          count={streakPreview}
          currentCount={
            skills.find((skill) => skill.id === entry.skillId)?.streakCount ?? 0
          }
          disabled={offline}
          onChange={setStreak}
        />
        <label>
          Minutes
          <input
            type="number"
            min={1}
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
        </label>
        <label>
          Activity
          <input
            maxLength={120}
            value={activity}
            onChange={(event) => setActivity(event.target.value)}
          />
        </label>
        <label>
          Notes
          <textarea
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className={styles.primary} disabled={offline} type="submit">
            Save changes
          </button>
        </footer>
      </form>
    </Modal>
  )
}
