import { type CSSProperties, useState } from 'react'
import {
  ArrowUpDown,
  Link2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
} from 'lucide-react'
import type { SkillResponse } from '@rlrpg/shared/contracts'
import { SkillDialog } from '@/components/SkillDialog/SkillDialog'
import { XpDialog } from '@/components/XpDialog/XpDialog'
import { useAppDispatch, useAppSelector } from '@/hooks'
import { refreshData, setSkillArchived } from '@/store'
import {
  SkillSheetLogic,
  type SkillSort,
} from '@/components/SkillSheet/SkillSheet.logic'
import styles from './SkillSheet.module.scss'

type SkillCardStyle = CSSProperties & {
  '--skill-color': string
}

export const SkillSheet = () => {
  const dispatch = useAppDispatch()
  const { skills, connection } = useAppSelector((state) => state.app)
  const offline = connection === 'offline'
  const active = skills.filter((skill) => !skill.archived)
  const archived = skills.filter((skill) => skill.archived)
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState<SkillSort>('name')
  const [editing, setEditing] = useState<SkillResponse | null | 'new'>(null)
  const [logging, setLogging] = useState<SkillResponse | null>(null)
  const visibleSkills = SkillSheetLogic.filterAndSort(active, filter, sort)

  const archive = async (skill: SkillResponse) => {
    await dispatch(
      setSkillArchived({ id: skill.id, archived: !skill.archived }),
    ).unwrap()
    await dispatch(refreshData())
  }

  return (
    <section>
      <div className={styles.ribbon}>
        <h1>Skill Sheet</h1>
      </div>
      <div className={styles.toolbar}>
        <div className={styles.controls}>
          <label className={styles.filter}>
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">Filter skills</span>
            <input
              type="search"
              value={filter}
              placeholder="Filter skills..."
              onChange={(event) => setFilter(event.target.value)}
            />
          </label>
          <label className={styles.sort}>
            <ArrowUpDown size={17} aria-hidden="true" />
            <span className="sr-only">Sort skills</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SkillSort)}
            >
              <option value="name">Name</option>
              <option value="level">Level</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          disabled={offline}
          onClick={() => setEditing('new')}
        >
          <Plus size={18} /> Add skill
        </button>
      </div>
      {active.length === 0 ? (
        <div className={styles.empty}>
          <span>✦</span>
          <h3>Your ledger is unmarked</h3>
          <p>Add the first skill you intend to practice.</p>
        </div>
      ) : visibleSkills.length === 0 ? (
        <div className={styles.empty}>
          <span>✦</span>
          <h3>No matching skills</h3>
          <p>Try a different name, skill code, or tag.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {visibleSkills.map((skill) => (
            <article
              className={styles.skill}
              key={skill.id}
              style={
                {
                  '--skill-color': skill.headerColor,
                } as SkillCardStyle
              }
            >
              <button
                className={styles.mainAction}
                type="button"
                disabled={offline}
                onClick={() => setLogging(skill)}
              >
                <span className={styles.icon}>
                  {skill.emoji ?? skill.code.slice(0, 1)}
                </span>
                <span className={styles.identity}>
                  <strong>{skill.name}</strong>
                  <small>{skill.code}</small>
                </span>
                <span className={styles.level}>
                  Level <strong>{skill.level}</strong>
                </span>
                <span className={styles.progress}>
                  <progress
                    className={styles.track}
                    max={skill.nextLevelXp}
                    value={skill.levelXp}
                  />
                </span>
                {skill.tags.length > 0 && (
                  <span className={styles.tags}>
                    {skill.tags.map((tag) => (
                      <small key={tag}>{tag}</small>
                    ))}
                  </span>
                )}
              </button>
              <div className={styles.actions}>
                <button
                  type="button"
                  title="Edit skill"
                  disabled={offline}
                  onClick={() => setEditing(skill)}
                >
                  <Pencil size={17} />
                </button>
                {skill.links.length > 0 && (
                  <span
                    title={skill.links
                      .map(
                        (link) => `${link.targetSkillName} ${link.percentage}%`,
                      )
                      .join(', ')}
                  >
                    <Link2 size={16} /> {skill.links.length}
                  </span>
                )}
                <small className={styles.xpCount}>
                  {skill.levelXp.toLocaleString()} /{' '}
                  {skill.nextLevelXp.toLocaleString()} XP
                </small>
              </div>
            </article>
          ))}
        </div>
      )}
      {archived.length > 0 && (
        <details className={styles.archived}>
          <summary>Archived skills ({archived.length})</summary>
          {archived.map((skill) => (
            <div key={skill.id}>
              <span>
                {skill.emoji} {skill.name} · {skill.totalXp.toLocaleString()} XP
              </span>
              <button
                title="Restore skill"
                type="button"
                disabled={offline}
                onClick={() => void archive(skill)}
              >
                <RotateCcw size={16} />
              </button>
            </div>
          ))}
        </details>
      )}
      {editing !== null && (
        <SkillDialog
          skill={editing === 'new' ? null : editing}
          skills={active}
          onClose={() => setEditing(null)}
          onArchive={
            editing === 'new'
              ? undefined
              : () => {
                  void archive(editing).then(() => setEditing(null))
                }
          }
        />
      )}
      {logging !== null && (
        <XpDialog skill={logging} onClose={() => setLogging(null)} />
      )}
    </section>
  )
}
