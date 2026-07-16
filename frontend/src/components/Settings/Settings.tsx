import { type FormEvent, useMemo, useState } from 'react'
import {
  BookOpen,
  Copy,
  Download,
  ExternalLink,
  KeyRound,
  LogOut,
  Pencil,
  SlidersHorizontal,
  Trash2,
  UserRound,
} from 'lucide-react'
import type { FocusSettings, XpEntryResponse } from '@rlrpg/shared/contracts'
import { downloadExport } from '@/api'
import { AccountSettings } from '@/components/AccountSettings/AccountSettings'
import { HistoryEditDialog } from '@/components/Settings/HistoryEditDialog'
import { useAppDispatch, useAppSelector } from '@/hooks'
import {
  createApiKey,
  deleteXp,
  logout,
  refreshData,
  revokeApiKey,
  saveSettings,
} from '@/store'
import styles from './Settings.module.scss'

type SettingsTab = 'account' | 'practice' | 'history' | 'automation' | 'export'

export const Settings = () => {
  const dispatch = useAppDispatch()
  const { settings, entries, skills, apiKeys, user, connection } =
    useAppSelector((state) => state.app)
  const offline = connection === 'offline'
  const [tab, setTab] = useState<SettingsTab>('practice')
  const [draft, setDraft] = useState<FocusSettings | null>(settings)
  const [skillFilter, setSkillFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [editing, setEditing] = useState<XpEntryResponse | null>(null)
  const [keyName, setKeyName] = useState('')
  const [keyPreset, setKeyPreset] = useState<'reader' | 'writer'>('writer')
  const [newToken, setNewToken] = useState<string | null>(null)

  const filteredEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          (skillFilter === '' || entry.skillId === skillFilter) &&
          (sourceFilter === '' || entry.source === sourceFilter) &&
          (fromDate === '' || entry.date >= fromDate) &&
          (toDate === '' || entry.date <= toDate),
      ),
    [entries, fromDate, skillFilter, sourceFilter, toDate],
  )

  const savePractice = async (event: FormEvent) => {
    event.preventDefault()
    if (draft === null) return
    await dispatch(saveSettings(draft)).unwrap()
    await dispatch(refreshData())
  }
  const removeEntry = async (entry: XpEntryResponse) => {
    if (
      !window.confirm(`Delete the ${entry.xp} XP entry for ${entry.skillName}?`)
    )
      return
    await dispatch(deleteXp(entry.id)).unwrap()
    await dispatch(refreshData())
  }
  const makeKey = async (event: FormEvent) => {
    event.preventDefault()
    const result = await dispatch(
      createApiKey({ name: keyName, preset: keyPreset }),
    ).unwrap()
    setNewToken(result.token)
    setKeyName('')
  }
  const revoke = async (id: string) => {
    if (
      !window.confirm(
        'Revoke this API key? Scripts using it will stop working.',
      )
    )
      return
    await dispatch(revokeApiKey(id)).unwrap()
    await dispatch(refreshData())
  }

  if (settings === null || draft === null) return null
  return (
    <section className={styles.page}>
      <header>
        <div>
          <p>Ledger administration</p>
          <h1>Settings</h1>
        </div>
        <span>Signed in as {user?.username}</span>
      </header>
      <div className={styles.layout}>
        <nav aria-label="Settings sections">
          <button
            className={tab === 'account' ? styles.active : ''}
            type="button"
            onClick={() => setTab('account')}
          >
            <UserRound size={18} /> Account
          </button>
          <button
            className={tab === 'practice' ? styles.active : ''}
            type="button"
            onClick={() => setTab('practice')}
          >
            <SlidersHorizontal size={18} /> Focused Practice
          </button>
          <button
            className={tab === 'history' ? styles.active : ''}
            type="button"
            onClick={() => setTab('history')}
          >
            <BookOpen size={18} /> XP history
          </button>
          <button
            className={tab === 'automation' ? styles.active : ''}
            type="button"
            onClick={() => setTab('automation')}
          >
            <KeyRound size={18} /> Automation
          </button>
          <button
            className={tab === 'export' ? styles.active : ''}
            type="button"
            onClick={() => setTab('export')}
          >
            <Download size={18} /> Export
          </button>
          <button
            className={styles.logout}
            type="button"
            onClick={() => void dispatch(logout())}
          >
            <LogOut size={18} /> Log out
          </button>
        </nav>
        <div className={styles.content}>
          {tab === 'account' && <AccountSettings />}
          {tab === 'practice' && (
            <form
              className={styles.settingsForm}
              onSubmit={(event) => void savePractice(event)}
            >
              <h2>Focused Practice rules</h2>
              <p>
                Changes apply to new sessions. A running timer keeps its
                starting rules.
              </p>
              <div className={styles.fieldGrid}>
                <label>
                  Interval length <span>minutes</span>
                  <input
                    type="number"
                    disabled={offline}
                    min={1}
                    max={240}
                    value={draft.intervalMinutes}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        intervalMinutes: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Base XP
                  <input
                    type="number"
                    disabled={offline}
                    min={1}
                    max={100000}
                    value={draft.baseXp}
                    onChange={(event) =>
                      setDraft({ ...draft, baseXp: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  Normal roll rate <span>% per pip</span>
                  <input
                    type="number"
                    disabled={offline}
                    min={0}
                    max={100}
                    value={draft.normalPercentPerPip}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        normalPercentPerPip: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Natural 1 bonus <span>%</span>
                  <input
                    type="number"
                    disabled={offline}
                    min={0}
                    max={500}
                    value={draft.naturalOneBonusPercent}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        naturalOneBonusPercent: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Natural 20 bonus <span>%</span>
                  <input
                    type="number"
                    disabled={offline}
                    min={0}
                    max={500}
                    value={draft.naturalTwentyBonusPercent}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        naturalTwentyBonusPercent: Number(event.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <button
                className={styles.primary}
                disabled={offline}
                type="submit"
              >
                Save practice rules
              </button>
            </form>
          )}
          {tab === 'history' && (
            <div>
              <h2>XP history</h2>
              <div className={styles.filters}>
                <select
                  aria-label="Filter by skill"
                  value={skillFilter}
                  onChange={(event) => setSkillFilter(event.target.value)}
                >
                  <option value="">All skills</option>
                  {skills.map((skill) => (
                    <option key={skill.id} value={skill.id}>
                      {skill.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter by source"
                  value={sourceFilter}
                  onChange={(event) => setSourceFilter(event.target.value)}
                >
                  <option value="">All sources</option>
                  <option value="manual">Manual</option>
                  <option value="focus">Focused Practice</option>
                  <option value="automation">Automation</option>
                </select>
                <input
                  aria-label="From date"
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                />
                <input
                  aria-label="To date"
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                />
              </div>
              <div className={styles.history}>
                {filteredEntries.length === 0 && (
                  <p>No entries match these filters.</p>
                )}
                {filteredEntries.map((entry) => (
                  <article key={entry.id}>
                    <div>
                      <strong>{entry.skillName}</strong>
                      <span>
                        {entry.date} ·{' '}
                        {entry.source === 'focus'
                          ? 'Focused Practice'
                          : entry.source}
                        {entry.origin === null ? '' : ` via ${entry.origin}`}
                      </span>
                    </div>
                    <div className={styles.entryXp}>
                      +{entry.xp.toLocaleString()} XP
                      {entry.minutes === null ? (
                        ''
                      ) : (
                        <small>{entry.minutes} min</small>
                      )}
                    </div>
                    <div className={styles.entryActions}>
                      {entry.source !== 'focus' && (
                        <button
                          title="Edit entry"
                          type="button"
                          disabled={offline}
                          onClick={() => setEditing(entry)}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      <button
                        title="Delete entry"
                        type="button"
                        disabled={offline}
                        onClick={() => void removeEntry(entry)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {(entry.activity !== null ||
                      entry.notes !== null ||
                      entry.awards.length > 1 ||
                      entry.rolls.length > 0) && (
                      <details>
                        <summary>Details</summary>
                        <p>{entry.activity}</p>
                        {entry.notes !== null && <p>{entry.notes}</p>}
                        {entry.awards
                          .filter((award) => award.kind === 'linked')
                          .map((award) => (
                            <p key={award.skillId}>
                              Shared {award.amount} XP with {award.skillName} (
                              {award.percentage}%)
                            </p>
                          ))}
                        {entry.rolls.length > 0 && (
                          <p>Rolls: {entry.rolls.join(', ')}</p>
                        )}
                      </details>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}
          {tab === 'automation' && (
            <div>
              <h2>Automation keys</h2>
              <p>
                Create a key for scripts or assistants. The secret is only shown
                once.
              </p>
              {offline && (
                <p role="status">
                  API key details and management are unavailable offline.
                </p>
              )}
              {newToken !== null && (
                <div className={styles.token}>
                  <strong>New API key</strong>
                  <code>{newToken}</code>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(newToken)}
                  >
                    <Copy size={16} /> Copy
                  </button>
                </div>
              )}
              <form
                className={styles.keyForm}
                onSubmit={(event) => void makeKey(event)}
              >
                <label>
                  Key name
                  <input
                    required
                    disabled={offline}
                    maxLength={80}
                    value={keyName}
                    onChange={(event) => setKeyName(event.target.value)}
                    placeholder="Anki on desktop"
                  />
                </label>
                <label>
                  Access
                  <select
                    disabled={offline}
                    value={keyPreset}
                    onChange={(event) =>
                      setKeyPreset(event.target.value as 'reader' | 'writer')
                    }
                  >
                    <option value="writer">XP writer</option>
                    <option value="reader">Skill reader</option>
                  </select>
                </label>
                <button
                  className={styles.primary}
                  disabled={offline}
                  type="submit"
                >
                  Create key
                </button>
              </form>
              <div className={styles.keyList}>
                {apiKeys.map((key) => (
                  <div key={key.id}>
                    <span>
                      <strong>{key.name}</strong>
                      <small>
                        {key.preset === 'writer'
                          ? 'Skill read + XP write'
                          : 'Skill read'}{' '}
                        · …{key.prefix}
                      </small>
                    </span>
                    <button
                      title="Revoke API key"
                      type="button"
                      disabled={offline}
                      onClick={() => void revoke(key.id)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </div>
              <a className={styles.docs} href="/api/docs" target="_blank">
                Open API documentation <ExternalLink size={15} />
              </a>
            </div>
          )}
          {tab === 'export' && (
            <div>
              <h2>Export your ledger</h2>
              <p>
                Download portable CSV files for spreadsheets, analysis, or
                backups.
              </p>
              <div className={styles.exports}>
                <button
                  type="button"
                  disabled={offline}
                  onClick={() =>
                    void downloadExport('/exports/skills.csv', 'skills.csv')
                  }
                >
                  <Download size={20} />
                  <span>
                    <strong>Skills CSV</strong>
                    <small>Skills, codes, levels, and links</small>
                  </span>
                </button>
                <button
                  type="button"
                  disabled={offline}
                  onClick={() =>
                    void downloadExport(
                      '/exports/xp-history.csv',
                      'xp-history.csv',
                    )
                  }
                >
                  <Download size={20} />
                  <span>
                    <strong>XP history CSV</strong>
                    <small>Entries, awards, origins, and rolls</small>
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {editing !== null && (
        <HistoryEditDialog entry={editing} onClose={() => setEditing(null)} />
      )}
    </section>
  )
}
