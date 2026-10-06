import { useState, type FormEvent } from 'react'
import type {
  AchievementResponse,
  SkillResponse,
  XpEntryResponse,
} from '@rlrpg/shared/contracts'
import { MAXIMUM_MANUAL_XP } from '@rlrpg/shared/rules'
import { Plus, Check } from 'lucide-react'
import { api, apiErrorMessage } from '@/api'
import { useAppDispatch, useAppSelector } from '@/hooks'
import { deleteXp, refreshData } from '@/store'
import { Modal } from '@/components/Modal/Modal'
import { HistoryList } from '@/components/Settings/HistoryList'
import { HistoryEditDialog } from '@/components/Settings/HistoryEditDialog'
import styles from './SkillDetails.module.scss'

const AchievementIcon = ({ icon }: { icon: string }) =>
  icon.startsWith('data:image/') ? (
    <img src={icon} alt="" />
  ) : (
    <span>{icon || '🏆'}</span>
  )

export const SkillDetails = ({
  skill,
  onClose,
}: {
  skill: SkillResponse
  onClose: () => void
}) => {
  const dispatch = useAppDispatch()
  const { achievements, entries, connection } = useAppSelector(
    (state) => state.app,
  )
  const offline = connection === 'offline'
  const [tab, setTab] = useState<'achievements' | 'history'>('achievements')
  const [selected, setSelected] = useState<AchievementResponse | 'new' | null>(
    null,
  )
  const [editing, setEditing] = useState<XpEntryResponse | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [source, setSource] = useState('')
  const [error, setError] = useState('')
  const removeEntry = async (entry: XpEntryResponse) => {
    if (
      !window.confirm(
        entry.source === 'achievement'
          ? 'Undo this achievement and its XP reward?'
          : `Delete this ${entry.xp} XP entry?`,
      )
    )
      return
    try {
      await dispatch(deleteXp(entry.id)).unwrap()
      await dispatch(refreshData()).unwrap()
    } catch (error) {
      setError(apiErrorMessage(error as Error))
    }
  }
  const history = entries.filter(
    (e) =>
      e.awards.some((a) => a.skillId === skill.id) &&
      (!from || e.date >= from) &&
      (!to || e.date <= to) &&
      (!source || e.source === source),
  )
  if (selected !== null)
    return (
      <AchievementDialog
        key={selected === 'new' ? 'new' : selected.id}
        skill={skill}
        achievement={selected === 'new' ? null : selected}
        onClose={() => setSelected(null)}
      />
    )
  if (editing)
    return (
      <HistoryEditDialog entry={editing} onClose={() => setEditing(null)} />
    )
  return (
    <Modal title={skill.name} onClose={onClose} wide>
      <div className={styles.body}>
        <div className={styles.identity}>
          <span className={styles.skillIcon}>
            {skill.emoji ?? skill.code[0]}
          </span>
          <div>
            <strong>{skill.name}</strong>
            <small>
              {skill.code} · {skill.totalXp.toLocaleString()} total XP
            </small>
          </div>
          <strong>Level {skill.level}</strong>
        </div>
        <progress
          aria-label={`${skill.name} level progress`}
          max={skill.nextLevelXp}
          value={skill.levelXp}
        />
        <small>
          {skill.levelXp.toLocaleString()} /{' '}
          {skill.nextLevelXp.toLocaleString()} XP
        </small>
        <div className={styles.tabs} role="tablist" aria-label="Skill details">
          {(['achievements', 'history'] as const).map((value) => (
            <button
              key={value}
              role="tab"
              aria-selected={tab === value}
              aria-controls="skill-panel"
              id={`tab-${value}`}
              onClick={() => setTab(value)}
            >
              {value === 'achievements' ? 'Achievements' : 'History'}
            </button>
          ))}
        </div>
        {error && <p role="alert">{error}</p>}
        <div id="skill-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {tab === 'achievements' ? (
            <>
              <div className={styles.grid}>
                {achievements
                  .filter((a) => a.skillId === skill.id)
                  .map((a) => (
                    <button
                      className={`${styles.achievement} ${a.earnedEntryId ? '' : styles.unearned}`}
                      key={a.id}
                      onClick={() => setSelected(a)}
                      title={`${a.name} · ${a.earnedEntryId ? 'Obtained' : 'Not obtained'}`}
                    >
                      <AchievementIcon icon={a.icon} />
                      <strong>{a.name}</strong>
                      {a.earnedEntryId && (
                        <Check size={16} aria-label="Obtained" />
                      )}
                    </button>
                  ))}
                <button
                  className={styles.add}
                  disabled={offline}
                  onClick={() => setSelected('new')}
                >
                  <Plus size={30} />
                  Add achievement
                </button>
              </div>
            </>
          ) : (
            <>
              <div className={styles.filters}>
                <label>
                  From
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </label>
                <label>
                  Source
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                  >
                    <option value="">All sources</option>
                    <option value="manual">Manual</option>
                    <option value="focus">Focused Practice</option>
                    <option value="automation">Automation</option>
                    <option value="achievement">Achievement</option>
                  </select>
                </label>
              </div>
              <HistoryList
                entries={history}
                skillId={skill.id}
                offline={offline}
                setEditing={setEditing}
                removeEntry={removeEntry}
              />
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

const AchievementDialog = ({
  skill,
  achievement,
  onClose,
}: {
  skill: SkillResponse
  achievement: AchievementResponse | null
  onClose: () => void
}) => {
  const dispatch = useAppDispatch()
  const offline = useAppSelector((state) => state.app.connection === 'offline')
  const [name, setName] = useState(achievement?.name ?? '')
  const [description, setDescription] = useState(achievement?.description ?? '')
  const [icon, setIcon] = useState(achievement?.icon ?? '🏆')
  const [xp, setXp] = useState(achievement?.xp ?? 0)
  const [bonusAward, setBonusAward] = useState(achievement?.bonusAward ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const earned = Boolean(achievement?.earnedEntryId)
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await action()
      await dispatch(refreshData()).unwrap()
      onClose()
    } catch (error) {
      setError(apiErrorMessage(error as Error))
    } finally {
      setBusy(false)
    }
  }
  const save = (event: FormEvent) => {
    event.preventDefault()
    void run(() =>
      achievement
        ? api.put(`/skills/${skill.id}/achievements/${achievement.id}`, {
            name,
            description,
            icon,
            xp,
            bonusAward,
          })
        : api.post(`/skills/${skill.id}/achievements`, {
            name,
            description,
            icon,
            xp,
            bonusAward,
          }),
    )
  }
  const upload = async (file?: File) => {
    if (!file) return
    if (
      !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(
        file.type,
      ) ||
      file.size > 140000
    ) {
      setError('Choose a PNG, JPEG, WebP, or GIF image smaller than 140 KB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setIcon(String(reader.result))
    reader.onerror = () => setError('Unable to read this image.')
    reader.readAsDataURL(file)
  }
  return (
    <Modal
      title={achievement ? 'Achievement details' : 'Add achievement'}
      onClose={onClose}
    >
      <form className={styles.body} onSubmit={save}>
        <div className={styles.preview}>
          <AchievementIcon icon={icon} />
        </div>
        {earned && (
          <p>
            Obtained {achievement?.obtainedAt}. Undo the achievement to edit its
            reward.
          </p>
        )}
        <fieldset disabled={offline || busy || earned}>
          <label>
            Name
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Emoji
            <input
              maxLength={16}
              value={icon.startsWith('data:') ? '' : icon}
              onChange={(e) => setIcon(e.target.value)}
            />
          </label>
          <label>
            Or upload an image
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => void upload(e.target.files?.[0])}
            />
          </label>
          <label>
            Description
            <textarea
              maxLength={4000}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label>
            XP reward
            <input
              type="number"
              min={0}
              max={MAXIMUM_MANUAL_XP}
              required
              value={xp}
              onChange={(e) => setXp(Number(e.target.value))}
            />
          </label>
          <label>
            Bonus award
            <input
              maxLength={1000}
              placeholder="Optional reward"
              value={bonusAward}
              onChange={(e) => setBonusAward(e.target.value)}
            />
          </label>
        </fieldset>
        {error && <p role="alert">{error}</p>}
        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          {!earned && (
            <button disabled={offline || busy} type="submit">
              Save
            </button>
          )}
        </footer>
        {achievement && (
          <button
            className={styles.primary}
            type="button"
            disabled={offline || busy}
            onClick={() =>
              void run(() =>
                api.put(`/achievements/${achievement.id}/obtained`, {
                  obtained: !earned,
                }),
              )
            }
          >
            {earned
              ? 'Undo achievement and XP'
              : `Mark obtained (+${achievement.xp} XP)`}
          </button>
        )}
      </form>
    </Modal>
  )
}
