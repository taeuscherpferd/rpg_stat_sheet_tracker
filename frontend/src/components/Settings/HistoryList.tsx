import type { XpEntryResponse } from '@rlrpg/shared/contracts'
import { Pencil, Trash2 } from 'lucide-react'
import styles from './Settings.module.scss'

export const HistoryList = ({
  entries,
  offline,
  setEditing,
  removeEntry,
  skillId,
}: {
  entries: XpEntryResponse[]
  offline: boolean
  setEditing: (entry: XpEntryResponse) => void
  removeEntry: (entry: XpEntryResponse) => Promise<void>
  skillId?: string
}) => (
  <div className={styles.history}>
    {entries.length === 0 && <p>No entries match these filters.</p>}
    {entries.map((entry) => (
      <article key={entry.id}>
        <div>
          <strong>{entry.skillName}</strong>
          <span>
            {entry.date} ·{' '}
            {entry.source === 'focus' ? 'Focused Practice' : entry.source}
            {entry.origin === null ? '' : ` via ${entry.origin}`}
          </span>
        </div>
        <div className={styles.entryXp}>
          +
          {(skillId
            ? entry.awards
                .filter((a) => a.skillId === skillId)
                .reduce((sum, a) => sum + a.amount, 0)
            : entry.xp
          ).toLocaleString()}{' '}
          XP
          {entry.minutes === null ? '' : <small>{entry.minutes} min</small>}
        </div>
        <div className={styles.entryActions}>
          {entry.source !== 'focus' && entry.source !== 'achievement' && (
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
            title={
              entry.source === 'achievement'
                ? 'Undo achievement'
                : 'Delete entry'
            }
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
            {entry.rolls.length > 0 && <p>Rolls: {entry.rolls.join(', ')}</p>}
          </details>
        )}
      </article>
    ))}
  </div>
)
