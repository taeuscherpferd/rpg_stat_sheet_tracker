import { type FormEvent, useState } from 'react'
import { Archive, Plus, Trash2 } from 'lucide-react'
import type { SkillResponse } from '@rlrpg/shared/contracts'
import { AppLogic } from '@/components/App/App.logic'
import { Modal } from '@/components/Modal/Modal'
import { SkillDialogLogic } from '@/components/SkillDialog/SkillDialog.logic'
import { useAppDispatch } from '@/hooks'
import { refreshData, saveSkill } from '@/store'
import styles from './SkillDialog.module.scss'

interface SkillDialogProps {
  skill: SkillResponse | null
  skills: SkillResponse[]
  onClose: () => void
  onArchive?: () => void
}
interface LinkDraft {
  targetSkillId: string
  percentage: number
}

export const SkillDialog = ({
  skill,
  skills,
  onClose,
  onArchive,
}: SkillDialogProps) => {
  const dispatch = useAppDispatch()
  const [name, setName] = useState(skill?.name ?? '')
  const [code, setCode] = useState(skill?.code ?? '')
  const [emoji, setEmoji] = useState(skill?.emoji ?? '')
  const [tags, setTags] = useState(skill?.tags.join(', ') ?? '')
  const [headerColor, setHeaderColor] = useState(
    skill?.headerColor ?? '#334b3f',
  )
  const [startingLevel, setStartingLevel] = useState('1')
  const [links, setLinks] = useState<LinkDraft[]>(
    skill?.links.map((link) => ({
      targetSkillId: link.targetSkillId,
      percentage: link.percentage,
    })) ?? [],
  )

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    await dispatch(
      saveSkill({
        id: skill?.id,
        name,
        code: code.toUpperCase(),
        emoji: emoji === '' ? null : emoji,
        tags: SkillDialogLogic.parseTags(tags),
        headerColor,
        startingLevel: skill === null ? Number(startingLevel) : undefined,
        links,
      }),
    ).unwrap()
    await dispatch(refreshData())
    onClose()
  }

  const changeName = (value: string) => {
    setName(value)
    if (skill === null) setCode(AppLogic.suggestCode(value))
  }

  return (
    <Modal
      title={skill === null ? 'Add a skill' : 'Edit skill'}
      onClose={onClose}
    >
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <div className={styles.row}>
          <label className={styles.name}>
            Skill name
            <input
              required
              maxLength={80}
              value={name}
              onChange={(event) => changeName(event.target.value)}
            />
          </label>
          <label className={styles.code}>
            Code
            <input
              required
              pattern="[A-Za-z0-9]{3}"
              maxLength={3}
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
          </label>
          <label className={styles.emoji}>
            Emoji
            <input
              maxLength={8}
              value={emoji}
              onChange={(event) => setEmoji(event.target.value)}
              placeholder="✦"
            />
          </label>
        </div>
        {skill === null && (
          <label className={styles.startingLevel}>
            Starting level
            <input
              required
              type="number"
              min={1}
              max={9999}
              value={startingLevel}
              onChange={(event) => setStartingLevel(event.target.value)}
            />
          </label>
        )}
        <label>
          Tags
          <input
            value={tags}
            maxLength={207}
            pattern="\s*[^,]{1,24}\s*(,\s*[^,]{1,24}\s*){0,7}"
            title="Enter up to eight comma-separated tags of 24 characters each"
            placeholder="creative, fitness, daily"
            onChange={(event) => setTags(event.target.value)}
          />
          <span className={styles.hint}>
            Separate up to eight tags with commas. Each tag can be 24
            characters.
          </span>
        </label>
        <fieldset>
          <legend>
            Skill Color <span>Customize this skill on your sheet.</span>
          </legend>
          <label className={styles.color}>
            <span className="sr-only">Skill color</span>
            <input
              type="color"
              value={headerColor}
              onChange={(event) => setHeaderColor(event.target.value)}
            />
          </label>
        </fieldset>
        <fieldset>
          <legend>
            Linked skills <span>Share up to 30% XP with three skills.</span>
          </legend>
          {links.map((link, index) => (
            <div className={styles.link} key={`${index}-${link.targetSkillId}`}>
              <select
                required
                value={link.targetSkillId}
                onChange={(event) =>
                  setLinks(
                    links.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, targetSkillId: event.target.value }
                        : item,
                    ),
                  )
                }
              >
                <option value="">Choose a skill</option>
                {skills
                  .filter(
                    (candidate) =>
                      candidate.id !== skill?.id &&
                      !links.some(
                        (item, itemIndex) =>
                          itemIndex !== index &&
                          item.targetSkillId === candidate.id,
                      ),
                  )
                  .map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.emoji} {candidate.name}
                    </option>
                  ))}
              </select>
              <label>
                <span className="sr-only">Share percentage</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={link.percentage}
                  onChange={(event) =>
                    setLinks(
                      links.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, percentage: Number(event.target.value) }
                          : item,
                      ),
                    )
                  }
                />
                <span>%</span>
              </label>
              <button
                type="button"
                title="Remove link"
                onClick={() =>
                  setLinks(
                    links.filter((_item, itemIndex) => itemIndex !== index),
                  )
                }
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
          {links.length < 3 &&
            skills.some((candidate) => candidate.id !== skill?.id) && (
              <button
                className={styles.addLink}
                type="button"
                onClick={() =>
                  setLinks([...links, { targetSkillId: '', percentage: 10 }])
                }
              >
                <Plus size={16} /> Add linked skill
              </button>
            )}
        </fieldset>
        <footer>
          {onArchive !== undefined && (
            <button
              className={styles.archive}
              type="button"
              onClick={() => {
                if (window.confirm(`Archive ${skill?.name ?? 'this skill'}?`)) {
                  onArchive()
                }
              }}
            >
              <Archive size={16} /> Archive
            </button>
          )}
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className={styles.primary} type="submit">
            Save skill
          </button>
        </footer>
      </form>
    </Modal>
  )
}
