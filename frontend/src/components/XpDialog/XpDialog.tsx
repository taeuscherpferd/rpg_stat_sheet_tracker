import { type FormEvent, useEffect, useState } from 'react'
import { Flame } from 'lucide-react'
import type { SkillResponse } from '@rlrpg/shared/contracts'
import { DEFAULT_MAXIMUM_MANUAL_XP } from '@rlrpg/shared/rules'
import { api } from '@/api'
import { AppLogic } from '@/components/App/App.logic'
import { Modal } from '@/components/Modal/Modal'
import {
  XpCelebrationLogic,
  type XpAwardPresentation,
} from '@/components/XpCelebration/XpCelebration.logic'
import { useAppDispatch, useAppSelector } from '@/hooks'
import { addXp, refreshData } from '@/store'
import styles from './XpDialog.module.scss'

interface XpDialogProps {
  skill: SkillResponse
  onClose: () => void
  onXpAwarded: (presentation: XpAwardPresentation) => void
}

export const XpDialog = ({ skill, onClose, onXpAwarded }: XpDialogProps) => {
  const dispatch = useAppDispatch()
  const { settings, connection, entries } = useAppSelector(
    (state) => state.app,
  )
  const offline = connection === 'offline'
  const [date, setDate] = useState(AppLogic.today())
  const [xp, setXp] = useState('')
  const [minutes, setMinutes] = useState('')
  const [activity, setActivity] = useState('')
  const [notes, setNotes] = useState('')
  const [streak, setStreak] = useState(false)
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
    const entry = await dispatch(
      addXp({
        skillId: skill.id,
        date,
        xp: Number(xp),
        minutes: minutes === '' ? null : Number(minutes),
        activity: activity || null,
        notes: notes || null,
        streak,
      }),
    ).unwrap()
    onClose()
    const refreshAction = await dispatch(refreshData())
    if (refreshData.fulfilled.match(refreshAction)) {
      onXpAwarded(
        XpCelebrationLogic.createPresentation(
          refreshAction.payload.skills,
          entry.awards,
        ),
      )
    }
  }

  const streakPreview = () => {
    const markedDates = new Set(
      entries
        .filter((entry) => entry.skillId === skill.id && entry.streak === true)
        .map((entry) => entry.date),
    )
    if (streak) markedDates.add(date)
    let currentDate = date
    let count = 0
    while (markedDates.has(currentDate)) {
      count += 1
      const previousDate = new Date(`${currentDate}T00:00:00.000Z`)
      previousDate.setUTCDate(previousDate.getUTCDate() - 1)
      currentDate = previousDate.toISOString().slice(0, 10)
    }
    return count
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
              max={settings?.maximumManualXp ?? DEFAULT_MAXIMUM_MANUAL_XP}
              value={xp}
              onChange={(event) => setXp(event.target.value)}
            />
          </label>
        </div>
        <button
          className={`${styles.streakToggle} ${streak ? styles.streakActive : ''}`}
          type="button"
          aria-pressed={streak}
          aria-label="Count this XP entry toward the skill streak"
          onClick={() => setStreak((wasMarked) => !wasMarked)}
        >
          <span className={styles.streakBox} aria-hidden="true">
            {streak && '✓'}
          </span>
          <span>Streak</span>
          {streak ? (
            <span className={styles.streakCount}>
              <Flame size={18} aria-hidden="true" /> {streakPreview()}
            </span>
          ) : (
            <span className={styles.streakCurrent}>
              {skill.streakCount ?? 0} day streak
            </span>
          )}
        </button>
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
          <button className={styles.primary} disabled={offline} type="submit">
            Add XP
          </button>
        </footer>
      </form>
    </Modal>
  )
}
