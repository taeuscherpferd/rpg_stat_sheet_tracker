import { type FormEvent, useEffect, useState } from 'react'
import type { SkillResponse } from '@rlrpg/shared/contracts'
import { api } from '@/api'
import { AppLogic } from '@/components/App/App.logic'
import { Modal } from '@/components/Modal/Modal'
import { useAppDispatch } from '@/hooks'
import { addXp, refreshData } from '@/store'
import styles from './XpDialog.module.scss'

interface XpDialogProps {
  skill: SkillResponse
  onClose: () => void
}

export const XpDialog = ({ skill, onClose }: XpDialogProps) => {
  const dispatch = useAppDispatch()
  const [date, setDate] = useState(AppLogic.today())
  const [xp, setXp] = useState('')
  const [minutes, setMinutes] = useState('')
  const [activity, setActivity] = useState('')
  const [notes, setNotes] = useState('')
  const [activities, setActivities] = useState<string[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        setActivities(
          (
            await api.get<string[]>('/activities', {
              params: { skillId: skill.id },
            })
          ).data,
        )
      } catch {
        setActivities([])
      }
    }
    void load()
  }, [skill.id])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    await dispatch(
      addXp({
        skillId: skill.id,
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
    <Modal title={`Record XP · ${skill.name}`} onClose={onClose}>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <div className={styles.row}>
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
            XP gained
            <input
              required
              autoFocus
              type="number"
              min={1}
              max={1000000}
              value={xp}
              onChange={(event) => setXp(event.target.value)}
            />
          </label>
        </div>
        <label>
          Time spent <span>(minutes)</span>
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
            list="activity-options"
            maxLength={120}
            value={activity}
            onChange={(event) => setActivity(event.target.value)}
            placeholder="What did you practice?"
          />
        </label>
        <datalist id="activity-options">
          {activities.map((item) => (
            <option value={item} key={item} />
          ))}
        </datalist>
        <label>
          Notes
          <textarea
            rows={4}
            maxLength={4000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        {skill.links.length > 0 && (
          <p className={styles.share}>
            Also shares{' '}
            {skill.links
              .map((link) => `${link.percentage}% with ${link.targetSkillName}`)
              .join(', ')}
            .
          </p>
        )}
        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className={styles.primary} type="submit">
            Add XP
          </button>
        </footer>
      </form>
    </Modal>
  )
}
