import { type FormEvent, useState } from 'react'
import type { XpEntryResponse } from '@rlrpg/shared/contracts'
import { Modal } from '@/components/Modal/Modal'
import { useAppDispatch } from '@/hooks'
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
  const [date, setDate] = useState(entry.date)
  const [xp, setXp] = useState(String(entry.xp))
  const [minutes, setMinutes] = useState(
    entry.minutes === null ? '' : String(entry.minutes),
  )
  const [activity, setActivity] = useState(entry.activity ?? '')
  const [notes, setNotes] = useState(entry.notes ?? '')
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
            <input
              required
              type="number"
              min={1}
              value={xp}
              onChange={(event) => setXp(event.target.value)}
            />
          </label>
        </div>
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
          <button className={styles.primary} type="submit">
            Save changes
          </button>
        </footer>
      </form>
    </Modal>
  )
}
