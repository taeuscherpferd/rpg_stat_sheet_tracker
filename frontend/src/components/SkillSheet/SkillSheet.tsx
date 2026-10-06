import { SkillDetails } from '@/components/SkillDetails/SkillDetails'
import { LevelUpCelebration } from '@/components/LevelUpCelebration/LevelUpCelebration'
import { SkillCard } from '@/components/SkillCard/SkillCard'
import { SkillDialog } from '@/components/SkillDialog/SkillDialog'
import { useXpAwardAnimation } from '@/components/XpCelebration/hooks/useXpAwardAnimation'
import {
  SkillSheetLogic,
  type SkillSort,
} from '@/components/SkillSheet/SkillSheet.logic'
import {
  XpCelebrationLogic,
  type XpAwardPresentation,
  type XpCelebrationEvent,
} from '@/components/XpCelebration/XpCelebration.logic'
import { XpDialog } from '@/components/XpDialog/XpDialog'
import { useAppDispatch, useAppSelector } from '@/hooks'
import { refreshData, setSkillArchived } from '@/store'
import type { SkillResponse } from '@rlrpg/shared/contracts'
import { ArrowUpDown, Plus, RotateCcw, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import styles from './SkillSheet.module.scss'

interface SkillSheetProps {
  xpCelebration: XpCelebrationEvent | null
  onXpCelebrationComplete: () => void
  onXpAwarded: (presentation: XpAwardPresentation) => void
}

export const SkillSheet = ({
  xpCelebration,
  onXpCelebrationComplete,
  onXpAwarded,
}: SkillSheetProps) => {
  const dispatch = useAppDispatch()
  const { skills, connection } = useAppSelector((state) => state.app)
  const offline = connection === 'offline'
  const active = skills.filter((skill) => !skill.archived)
  const archived = skills.filter((skill) => skill.archived)
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState<SkillSort>('name')
  const [editing, setEditing] = useState<SkillResponse | null | 'new'>(null)
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const detailsSkill = skills.find((skill) => skill.id === detailsId)
  const [logging, setLogging] = useState<SkillResponse | null>(null)
  const visibleSkills = SkillSheetLogic.filterAndSort(active, filter, sort)
  const { progressBySkillId, readyForCelebration } =
    useXpAwardAnimation(xpCelebration)
  const levelUps =
    xpCelebration === null ? [] : XpCelebrationLogic.levelUps(xpCelebration)

  useEffect(() => {
    if (
      xpCelebration !== null &&
      readyForCelebration &&
      levelUps.length === 0
    ) {
      onXpCelebrationComplete()
    }
  }, [
    levelUps.length,
    onXpCelebrationComplete,
    readyForCelebration,
    xpCelebration,
  ])

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
          {visibleSkills.map((skill) => {
            const animatedProgress = progressBySkillId[skill.id]
            const awardedXp = xpCelebration?.awards.find(
              (award) => award.skillId === skill.id,
            )

            return (
              <SkillCard
                key={skill.id}
                skill={skill}
                animatedProgress={animatedProgress}
                awardedXp={awardedXp}
                offline={offline}
                onDetails={(skill) => setDetailsId(skill.id)}
                onEdit={setEditing}
                onLogXp={setLogging}
              />
            )
          })}
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
      {detailsSkill && (
        <SkillDetails skill={detailsSkill} onClose={() => setDetailsId(null)} />
      )}
      {logging !== null && (
        <XpDialog
          skill={logging}
          onClose={() => setLogging(null)}
          onXpAwarded={onXpAwarded}
        />
      )}
      {readyForCelebration && levelUps.length > 0 && (
        <LevelUpCelebration
          key={xpCelebration?.id}
          awards={levelUps}
          onComplete={onXpCelebrationComplete}
        />
      )}
    </section>
  )
}
