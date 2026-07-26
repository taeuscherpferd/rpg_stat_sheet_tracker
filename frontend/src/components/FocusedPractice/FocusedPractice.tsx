import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  Check,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { FocusRules } from '@rlrpg/shared/rules'
import { AppLogic } from '@/components/App/App.logic'
import { Modal } from '@/components/Modal/Modal'
import {
  XpCelebrationLogic,
  type XpAwardPresentation,
} from '@/components/XpCelebration/XpCelebration.logic'
import { useAppDispatch, useAppSelector } from '@/hooks'
import { completeFocus, refreshData } from '@/store'
import { FocusedPracticeLogic, type TimerState } from './FocusedPractice.logic'
import { useFocusCompletionSound } from './hooks/useFocusCompletionSound'
import styles from './FocusedPractice.module.scss'

interface PracticeRoll {
  intervalNumber: number
  value: string
}

interface FocusedPracticeProps {
  onXpAwarded: (presentation: XpAwardPresentation) => void
}

export const FocusedPractice = ({ onXpAwarded }: FocusedPracticeProps) => {
  const dispatch = useAppDispatch()
  const { user, skills, settings, connection } = useAppSelector(
    (state) => state.app,
  )
  const offline = connection === 'offline'
  const activeSkills = skills.filter((skill) => !skill.archived)
  const storageKey = FocusedPracticeLogic.storageKey(user?.id ?? 'guest')
  const lastSkillStorageKey = FocusedPracticeLogic.lastSkillStorageKey(
    user?.id ?? 'guest',
  )
  const [timer, setTimer] = useState<TimerState | null>(() =>
    FocusedPracticeLogic.load(localStorage.getItem(storageKey)),
  )
  const [now, setNow] = useState(() => Date.now())
  const [selectedSkillId, setSelectedSkillId] = useState(() =>
    FocusedPracticeLogic.preferredSkillId(
      localStorage.getItem(lastSkillStorageKey),
      activeSkills.map((skill) => skill.id),
    ),
  )
  const [completing, setCompleting] = useState(false)
  const [rolls, setRolls] = useState<PracticeRoll[]>([])
  const [notes, setNotes] = useState('')
  const resumeOnCompletionCancelRef = useRef(false)
  const { play: playCompletionSound, prepare: prepareCompletionSound } =
    useFocusCompletionSound()
  const elapsed = timer === null ? 0 : FocusedPracticeLogic.elapsed(timer, now)
  const remaining =
    timer === null ? 0 : FocusedPracticeLogic.remaining(timer, now)
  const intervals =
    timer === null
      ? 0
      : FocusRules.completedIntervals(elapsed, timer.settings.intervalMinutes)
  const completedIntervalsRef = useRef(intervals)

  useEffect(() => {
    const interval = window.setInterval(() => {
      const currentTime = Date.now()
      setNow(currentTime)
      if (timer === null || timer.runningSince === null) return
      const currentIntervals = FocusRules.completedIntervals(
        FocusedPracticeLogic.elapsed(timer, currentTime),
        timer.settings.intervalMinutes,
      )
      if (currentIntervals > completedIntervalsRef.current)
        void playCompletionSound()
      completedIntervalsRef.current = currentIntervals
    }, 1000)
    return () => window.clearInterval(interval)
  }, [playCompletionSound, timer])
  useEffect(() => {
    if (timer === null) localStorage.removeItem(storageKey)
    else localStorage.setItem(storageKey, JSON.stringify(timer))
  }, [storageKey, timer])
  const selectedSkill = activeSkills.find(
    (skill) => skill.id === (timer?.skillId ?? selectedSkillId),
  )
  const parsedRolls = FocusedPracticeLogic.parseRollValues(
    rolls.map((roll) => roll.value),
  )
  const start = () => {
    if (settings !== null && selectedSkillId !== '') {
      completedIntervalsRef.current = 0
      void prepareCompletionSound()
      localStorage.setItem(lastSkillStorageKey, selectedSkillId)
      setTimer({
        skillId: selectedSkillId,
        elapsedSeconds: 0,
        runningSince: Date.now(),
        settings,
      })
    }
  }
  const openCompletion = () => {
    if (timer === null) return
    const completionTimer = FocusedPracticeLogic.pauseForCompletion(
      timer,
      Date.now(),
    )
    const completedIntervals = FocusRules.completedIntervals(
      completionTimer.timer.elapsedSeconds,
      completionTimer.timer.settings.intervalMinutes,
    )
    resumeOnCompletionCancelRef.current = completionTimer.shouldResume
    setTimer(completionTimer.timer)
    setRolls(
      Array.from({ length: completedIntervals }, (_, index) => ({
        intervalNumber: index + 1,
        value: '',
      })),
    )
    setCompleting(true)
  }
  const closeCompletion = () => {
    const shouldResume = resumeOnCompletionCancelRef.current
    resumeOnCompletionCancelRef.current = false
    setCompleting(false)
    setTimer((currentTimer) =>
      currentTimer === null
        ? null
        : FocusedPracticeLogic.cancelCompletion(
            currentTimer,
            shouldResume,
            Date.now(),
          ),
    )
  }
  const resetSessionState = () => {
    completedIntervalsRef.current = 0
    resumeOnCompletionCancelRef.current = false
    setTimer(null)
    setCompleting(false)
    setRolls([])
    setNotes('')
  }
  const discard = () => {
    if (!window.confirm('Discard this practice session?')) return
    resetSessionState()
  }
  const discardInterval = (intervalNumber: number) => {
    if (
      !window.confirm(
        `Discard interval ${intervalNumber}? Its roll and practice time will not be recorded.`,
      )
    )
      return
    setRolls((currentRolls) =>
      currentRolls.filter((roll) => roll.intervalNumber !== intervalNumber),
    )
  }
  const finish = async () => {
    if (timer === null || parsedRolls === null) return
    const entry = await dispatch(
      completeFocus({
        skillId: timer.skillId,
        date: AppLogic.today(),
        focusedSeconds: FocusedPracticeLogic.focusedSecondsForRetainedIntervals(
          elapsed,
          timer.settings.intervalMinutes,
          rolls.length,
        ),
        rolls: parsedRolls,
        notes: notes || null,
        settings: timer.settings,
      }),
    ).unwrap()
    resetSessionState()
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
                  {AppLogic.skillLabel(skill.name, skill.emoji)}
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
            disabled={selectedSkillId === '' || offline}
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
          <div
            className={styles.clock}
            style={
              {
                '--timer-drained': `${FocusedPracticeLogic.drainedFraction(timer, now)}turn`,
              } as CSSProperties & { '--timer-drained': string }
            }
          >
            <div>
              <strong>{FocusedPracticeLogic.format(remaining)}</strong>
              <span>
                {intervals} full interval{intervals === 1 ? '' : 's'}
              </span>
            </div>
          </div>
          <div className={styles.controls}>
            <button type="button" title="Cancel session" onClick={discard}>
              <RotateCcw size={20} />
            </button>
            {timer.runningSince === null ? (
              <button
                className={styles.play}
                title="Resume"
                type="button"
                onClick={() => {
                  void prepareCompletionSound()
                  setTimer(FocusedPracticeLogic.resume(timer, Date.now()))
                }}
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
              disabled={intervals < 1 || offline}
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
        <Modal title="Roll for your practice" onClose={closeCompletion}>
          <div className={styles.rollForm}>
            <p>
              You completed {intervals} interval{intervals === 1 ? '' : 's'}.
              Enter one physical d20 roll for each interval you want to keep.
            </p>
            <div className={styles.rolls}>
              {rolls.map((roll) => (
                <div className={styles.roll} key={roll.intervalNumber}>
                  <label>
                    Interval {roll.intervalNumber} roll
                    <input
                      required
                      type="number"
                      min={1}
                      max={20}
                      value={roll.value}
                      onChange={(event) =>
                        setRolls(
                          rolls.map((item) =>
                            item.intervalNumber === roll.intervalNumber
                              ? { ...item, value: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                  {rolls.length > 1 && (
                    <button
                      aria-label={`Discard interval ${roll.intervalNumber}`}
                      type="button"
                      title={`Discard interval ${roll.intervalNumber}`}
                      onClick={() => discardInterval(roll.intervalNumber)}
                    >
                      <Trash2 size={16} />
                      Discard
                    </button>
                  )}
                </div>
              ))}
            </div>
            {parsedRolls !== null && (
              <p className={styles.reward}>
                Award:{' '}
                <strong>
                  {FocusRules.totalXp(
                    parsedRolls,
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
              <button
                className={styles.discard}
                type="button"
                onClick={discard}
              >
                Discard session
              </button>
              <button type="button" onClick={closeCompletion}>
                Back
              </button>
              <button
                className={styles.confirm}
                disabled={offline || parsedRolls === null}
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
