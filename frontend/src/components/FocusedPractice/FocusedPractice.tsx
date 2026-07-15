import { useEffect, useState } from 'react'
import { Check, Pause, Play, RotateCcw, Shield, Sparkles } from 'lucide-react'
import { FocusRules } from '@rlrpg/shared/rules'
import { AppLogic } from '@/components/App/App.logic'
import { Modal } from '@/components/Modal/Modal'
import { useAppDispatch, useAppSelector } from '@/hooks'
import { completeFocus, refreshData } from '@/store'
import { FocusedPracticeLogic, type TimerState } from './FocusedPractice.logic'
import styles from './FocusedPractice.module.scss'

export const FocusedPractice = () => {
  const dispatch = useAppDispatch()
  const { user, skills, settings } = useAppSelector((state) => state.app)
  const activeSkills = skills.filter((skill) => !skill.archived)
  const storageKey = FocusedPracticeLogic.storageKey(user?.id ?? 'guest')
  const [timer, setTimer] = useState<TimerState | null>(() =>
    FocusedPracticeLogic.load(localStorage.getItem(storageKey)),
  )
  const [now, setNow] = useState(() => Date.now())
  const [selectedSkillId, setSelectedSkillId] = useState(
    activeSkills[0]?.id ?? '',
  )
  const [completing, setCompleting] = useState(false)
  const [rolls, setRolls] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const elapsed = timer === null ? 0 : FocusedPracticeLogic.elapsed(timer, now)
  const intervals =
    timer === null
      ? 0
      : FocusRules.completedIntervals(elapsed, timer.settings.intervalMinutes)

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])
  useEffect(() => {
    if (timer === null) localStorage.removeItem(storageKey)
    else localStorage.setItem(storageKey, JSON.stringify(timer))
  }, [storageKey, timer])

  const selectedSkill = activeSkills.find(
    (skill) => skill.id === (timer?.skillId ?? selectedSkillId),
  )
  const start = () => {
    if (settings !== null && selectedSkillId !== '')
      setTimer({
        skillId: selectedSkillId,
        elapsedSeconds: 0,
        runningSince: Date.now(),
        settings,
      })
  }
  const openCompletion = () => {
    setRolls(Array.from({ length: intervals }, () => ''))
    setCompleting(true)
  }
  const finish = async () => {
    if (timer === null) return
    await dispatch(
      completeFocus({
        skillId: timer.skillId,
        date: AppLogic.today(),
        focusedSeconds: elapsed,
        rolls: rolls.map(Number),
        notes: notes || null,
        settings: timer.settings,
      }),
    ).unwrap()
    setTimer(null)
    setCompleting(false)
    setNotes('')
    await dispatch(refreshData())
  }

  if (settings === null) return null
  return (
    <section className={styles.page}>
      <p className={styles.kicker}>Focused Practice</p>
      <h1>Hold the course</h1>
      <p className={styles.lead}>
        Choose one craft. Let each full interval earn its roll.
      </p>
      {timer === null ? (
        <div className={styles.startPanel}>
          <label>
            Skill to practice
            <select
              value={selectedSkillId}
              onChange={(event) => setSelectedSkillId(event.target.value)}
            >
              <option value="">Choose a skill</option>
              {activeSkills.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.emoji} {skill.name}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.rules}>
            <span>
              <Shield size={18} /> {settings.intervalMinutes} minute intervals
            </span>
            <span>
              <Sparkles size={18} /> {settings.baseXp} base XP + d20
            </span>
          </div>
          <button
            className={styles.start}
            disabled={selectedSkillId === ''}
            type="button"
            onClick={start}
          >
            <Play size={19} fill="currentColor" /> Begin practice
          </button>
        </div>
      ) : (
        <div className={styles.timerArea}>
          <p className={styles.skillName}>
            {selectedSkill?.emoji} {selectedSkill?.name}
          </p>
          <div className={styles.clock}>
            <div>
              <strong>{FocusedPracticeLogic.format(elapsed)}</strong>
              <span>
                {intervals} full interval{intervals === 1 ? '' : 's'}
              </span>
            </div>
          </div>
          <progress
            className={styles.intervalProgress}
            max={timer.settings.intervalMinutes * 60}
            value={elapsed % (timer.settings.intervalMinutes * 60)}
          />
          <div className={styles.controls}>
            <button
              type="button"
              title="Cancel session"
              onClick={() => {
                if (window.confirm('Discard this practice session?'))
                  setTimer(null)
              }}
            >
              <RotateCcw size={20} />
            </button>
            {timer.runningSince === null ? (
              <button
                className={styles.play}
                title="Resume"
                type="button"
                onClick={() =>
                  setTimer(FocusedPracticeLogic.resume(timer, Date.now()))
                }
              >
                <Play size={22} fill="currentColor" />
              </button>
            ) : (
              <button
                className={styles.play}
                title="Pause"
                type="button"
                onClick={() =>
                  setTimer(FocusedPracticeLogic.pause(timer, Date.now()))
                }
              >
                <Pause size={22} fill="currentColor" />
              </button>
            )}
            <button
              type="button"
              title="Complete session"
              disabled={intervals < 1}
              onClick={openCompletion}
            >
              <Check size={21} />
            </button>
          </div>
          {intervals < 1 && (
            <p className={styles.hint}>
              Complete the first {settings.intervalMinutes} minutes to earn a
              roll.
            </p>
          )}
        </div>
      )}
      {completing && timer !== null && (
        <Modal
          title="Roll for your practice"
          onClose={() => setCompleting(false)}
        >
          <div className={styles.rollForm}>
            <p>
              You completed {intervals} interval{intervals === 1 ? '' : 's'}.
              Enter one physical d20 roll for each.
            </p>
            <div className={styles.rolls}>
              {rolls.map((roll, index) => (
                <label key={index}>
                  Roll {index + 1}
                  <input
                    required
                    type="number"
                    min={1}
                    max={20}
                    value={roll}
                    onChange={(event) =>
                      setRolls(
                        rolls.map((item, itemIndex) =>
                          itemIndex === index ? event.target.value : item,
                        ),
                      )
                    }
                  />
                </label>
              ))}
            </div>
            {rolls.every((roll) => Number(roll) >= 1 && Number(roll) <= 20) && (
              <p className={styles.reward}>
                Award:{' '}
                <strong>
                  {FocusRules.totalXp(
                    rolls.map(Number),
                    timer.settings,
                  ).toLocaleString()}{' '}
                  XP
                </strong>
              </p>
            )}
            <label>
              Notes
              <textarea
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
            <footer>
              <button type="button" onClick={() => setCompleting(false)}>
                Back
              </button>
              <button
                className={styles.confirm}
                disabled={
                  !rolls.every(
                    (roll) => Number(roll) >= 1 && Number(roll) <= 20,
                  )
                }
                type="button"
                onClick={() => void finish()}
              >
                Claim XP
              </button>
            </footer>
          </div>
        </Modal>
      )}
    </section>
  )
}
