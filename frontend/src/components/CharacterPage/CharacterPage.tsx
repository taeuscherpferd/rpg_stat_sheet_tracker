import { useState } from 'react'
import type { AchievementResponse } from '@rlrpg/shared/contracts'
import characterSpriteSheet from '@/assets/characters/character-sprite-sheet.png'
import { CharacterBackground } from '@/components/CharacterBackground/CharacterBackground'
import { CharacterBackgroundLogic } from '@/components/CharacterBackground/CharacterBackground.logic'
import {
  characterBackgrounds,
  startingBackgroundId,
} from '@/components/CharacterBackground/CharacterBackground.data'
import { CharacterAppearanceControls } from '@/components/CharacterAppearanceControls/CharacterAppearanceControls'
import { CharacterTitleField } from '@/components/CharacterTitleField/CharacterTitleField'
import styles from './CharacterPage.module.scss'

type CharacterArtProps = {
  gender: string
  characterClass: string
}

const spriteColumns: Record<string, string> = {
  'Man-Adventurer': styles.spriteColumn0,
  'Woman-Adventurer': styles.spriteColumn1,
  'Man-Warrior': styles.spriteColumn2,
  'Woman-Warrior': styles.spriteColumn3,
  'Man-Ranger': styles.spriteColumn4,
  'Woman-Ranger': styles.spriteColumn5,
  'Man-Mage': styles.spriteColumn6,
  'Woman-Mage': styles.spriteColumn7,
  'Man-Rogue': styles.spriteColumn8,
  'Woman-Rogue': styles.spriteColumn9,
}

const weaponNames: Record<string, string> = {
  Adventurer: 'sword',
  Warrior: 'battle axe',
  Ranger: 'bow',
  Mage: 'crystal staff',
  Rogue: 'dual daggers',
}

const CharacterArt = ({ gender, characterClass }: CharacterArtProps) => {
  const columnClass =
    spriteColumns[`${gender}-${characterClass}`] ?? styles.spriteColumn0
  const weaponName = weaponNames[characterClass] ?? 'sword'

  return (
    <div
      className={`${styles.art} ${columnClass}`}
      role="img"
      aria-label={`${gender} ${characterClass} idle animation holding a ${weaponName}`}
    >
      <img className={styles.spriteSheet} src={characterSpriteSheet} alt="" />
    </div>
  )
}

type CharacterCardProps = {
  backgroundId: string
  titleAchievementId: string
  achievements: AchievementResponse[]
  name: string
  role: string
  description: string
  gender: string
  characterClass: string
  actionLabel?: string
  actionDisabled?: boolean
  onAction?: () => void
}

const CharacterCard = ({
  name,
  role,
  description,
  gender,
  characterClass,
  backgroundId,
  titleAchievementId,
  achievements,
  actionLabel,
  actionDisabled = false,
  onAction,
}: CharacterCardProps) => {
  const title = achievements.find(
    (achievement) =>
      achievement.id === titleAchievementId && achievement.earnedEntryId,
  )?.name
  return (
    <article className={styles.card}>
      <div className={styles.portrait}>
        <CharacterBackground backgroundId={backgroundId} />
        <CharacterArt gender={gender} characterClass={characterClass} />
        <span className={styles.role}>{role}</span>
      </div>
      <div className={styles.details}>
        {title && <span className={styles.eyebrow}>{title}</span>}
        <h2>{name}</h2>
        <p className={styles.characterGender}>Gender: {gender}</p>
        <p className={styles.characterDescription}>{description}</p>
        {actionLabel !== undefined && onAction !== undefined && (
          <button
            className={styles.selectButton}
            type="button"
            disabled={actionDisabled}
            onClick={onAction}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </article>
  )
}

type Character = {
  id: string
  name: string
  role: string
  description: string
}

type CharacterProfile = {
  appearanceId: string
  name: string
  gender: string
  characterClass: string
  description: string
  backgroundId: string
  titleAchievementId: string
}

const characters: Character[] = [
  {
    id: 'mira',
    name: 'Mira',
    role: 'Wanderer',
    description:
      'A warm smile, a steady stride, and a well-loved travel cloak.',
  },
  {
    id: 'rowan',
    name: 'Rowan',
    role: 'Pathfinder',
    description: 'A quick-eyed companion who always knows the way home.',
  },
]

const genders = ['Woman', 'Man']
const classes = ['Adventurer', 'Warrior', 'Ranger', 'Mage', 'Rogue']

const loadCharacterProfile = (
  savedValue: string | null,
): CharacterProfile | null => {
  if (savedValue === null) return null
  const legacyCharacter = characters.find(
    (character) => character.id === savedValue,
  )
  if (legacyCharacter !== undefined) {
    return {
      appearanceId: legacyCharacter.id,
      name: legacyCharacter.name,
      gender: legacyCharacter.id === 'mira' ? 'Woman' : 'Man',
      characterClass: 'Adventurer',
      description: legacyCharacter.description,
      backgroundId: startingBackgroundId,
      titleAchievementId: '',
    }
  }
  try {
    const profile = JSON.parse(savedValue) as CharacterProfile
    if (
      characters.some((character) => character.id === profile.appearanceId) &&
      typeof profile.name === 'string' &&
      typeof profile.gender === 'string' &&
      typeof profile.characterClass === 'string'
    ) {
      return {
        ...profile,
        gender: profile.gender === 'Woman' ? 'Woman' : 'Man',
        characterClass: classes.includes(profile.characterClass)
          ? profile.characterClass
          : 'Adventurer',
        appearanceId: profile.gender === 'Woman' ? 'mira' : 'rowan',
        backgroundId: characterBackgrounds.some(
          (background) => background.id === profile.backgroundId,
        )
          ? profile.backgroundId
          : startingBackgroundId,
        titleAchievementId:
          typeof profile.titleAchievementId === 'string'
            ? profile.titleAchievementId
            : '',
        description:
          typeof profile.description === 'string'
            ? profile.description
            : (characters.find(
                (character) =>
                  character.id ===
                  (profile.gender === 'Woman' ? 'mira' : 'rowan'),
              )?.description ?? ''),
      }
    }
  } catch {
    return null
  }
  return null
}

type CharacterPageProps = {
  userId: string
  achievements?: AchievementResponse[]
  totalXp?: number
}

const storageKeyFor = (userId: string): string => `rlrpg.character.${userId}`
const appearanceIdForGender = (gender: string): string =>
  gender === 'Woman' ? 'mira' : 'rowan'

export const CharacterPage = ({
  userId,
  achievements = [],
  totalXp = 0,
}: CharacterPageProps) => {
  const storageKey = storageKeyFor(userId)
  const [selectedProfile, setSelectedProfile] = useState(() =>
    loadCharacterProfile(localStorage.getItem(storageKey)),
  )
  const [choosing, setChoosing] = useState(selectedProfile === null)
  const [name, setName] = useState(selectedProfile?.name ?? '')
  const [gender, setGender] = useState(selectedProfile?.gender ?? 'Woman')
  const [characterClass, setCharacterClass] = useState(
    selectedProfile?.characterClass ?? 'Adventurer',
  )
  const [description, setDescription] = useState(
    selectedProfile?.description ?? characters[0].description,
  )
  const [backgroundId, setBackgroundId] = useState(
    selectedProfile?.backgroundId ?? startingBackgroundId,
  )
  const [titleAchievementId, setTitleAchievementId] = useState(
    selectedProfile?.titleAchievementId ?? '',
  )
  const readyToChoose =
    name.trim().length > 0 && gender !== '' && characterClass !== ''

  const saveProfile = (profile: CharacterProfile) => {
    localStorage.setItem(storageKey, JSON.stringify(profile))
    setSelectedProfile(profile)
  }

  const chooseCharacter = () => {
    if (!readyToChoose) return
    const profile = {
      appearanceId: appearanceIdForGender(gender),
      name: name.trim(),
      gender,
      characterClass,
      description: description.trim(),
      backgroundId: CharacterBackgroundLogic.availableBackground(
        backgroundId,
        totalXp,
      ),
      titleAchievementId,
    }
    saveProfile(profile)
    setChoosing(false)
  }

  const requestedBackgroundId = choosing
    ? backgroundId
    : (selectedProfile?.backgroundId ?? startingBackgroundId)
  const activeBackgroundId = CharacterBackgroundLogic.availableBackground(
    requestedBackgroundId,
    totalXp,
  )
  const activeTitleId = choosing
    ? titleAchievementId
    : (selectedProfile?.titleAchievementId ?? '')
  const availableTitleId = achievements.some(
    (achievement) =>
      achievement.id === activeTitleId && achievement.earnedEntryId,
  )
    ? activeTitleId
    : ''
  const updateAppearance = (nextBackgroundId: string, nextTitleId: string) => {
    if (
      !choosing ||
      !CharacterBackgroundLogic.isUnlocked(nextBackgroundId, totalXp)
    )
      return
    if (
      nextTitleId !== '' &&
      !achievements.some(
        (achievement) =>
          achievement.id === nextTitleId && achievement.earnedEntryId,
      )
    )
      return
    setBackgroundId(nextBackgroundId)
    setTitleAchievementId(nextTitleId)
  }
  const appearanceProps = {
    backgroundId: activeBackgroundId,
    titleAchievementId: availableTitleId,
    achievements,
  }

  const selectedCharacter = characters.find(
    (character) => character.id === selectedProfile?.appearanceId,
  )
  const previewCharacter =
    gender === ''
      ? undefined
      : characters.find(
          (character) => character.id === appearanceIdForGender(gender),
        )

  return (
    <section className={styles.page} aria-labelledby="characters-title">
      <header className={styles.intro}>
        <span className={styles.kicker}>
          {choosing ? 'Create your character' : 'Your character'}
        </span>
        <h1 id="characters-title">
          {choosing ? 'Character details' : selectedProfile?.name}
        </h1>
        <p>
          {choosing
            ? 'Your gender shapes your character. Your class decides their weapon.'
            : 'This is the face of your next adventure.'}
        </p>
      </header>
      {choosing ? (
        <>
          <div className={styles.characterForm}>
            <CharacterTitleField
              achievements={achievements}
              value={availableTitleId}
              onChange={(achievementId) =>
                updateAppearance(activeBackgroundId, achievementId)
              }
            />
            <label>
              <span>Name</span>
              <input
                autoComplete="off"
                maxLength={40}
                placeholder="Enter a character name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              <span>Gender</span>
              <select
                value={gender}
                onChange={(event) => setGender(event.target.value)}
              >
                {genders.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Class</span>
              <select
                value={characterClass}
                onChange={(event) => setCharacterClass(event.target.value)}
              >
                {classes.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.descriptionField}>
              <span>Description</span>
              <textarea
                rows={4}
                maxLength={1000}
                placeholder="Tell your character's story"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
          </div>
          <p className={styles.formHint}>
            Your character preview updates as you choose.
          </p>
          {previewCharacter === undefined ? (
            <p className={styles.previewPrompt}>
              Choose a gender to preview your character.
            </p>
          ) : (
            <div className={styles.selected}>
              <CharacterAppearanceControls
                backgroundId={activeBackgroundId}
                totalXp={totalXp}
                onBackgroundChange={(nextBackgroundId) =>
                  updateAppearance(nextBackgroundId, availableTitleId)
                }
              />
              <CharacterCard
                {...appearanceProps}
                {...previewCharacter}
                name={name.trim() || 'Your character'}
                role={characterClass}
                gender={gender}
                characterClass={characterClass}
                description={description}
                actionLabel={
                  selectedProfile === null ? 'Create character' : 'Save changes'
                }
                actionDisabled={!readyToChoose}
                onAction={chooseCharacter}
              />
            </div>
          )}
          {selectedProfile !== null && (
            <button
              className={styles.changeButton}
              type="button"
              onClick={() => setChoosing(false)}
            >
              Keep current character
            </button>
          )}
        </>
      ) : (
        <div className={styles.selected}>
          {selectedCharacter !== undefined && selectedProfile !== null && (
            <CharacterCard
              {...appearanceProps}
              {...selectedCharacter}
              name={selectedProfile.name}
              role={selectedProfile.characterClass}
              gender={selectedProfile.gender}
              characterClass={selectedProfile.characterClass}
              description={selectedProfile.description}
            />
          )}
          <button
            className={styles.changeButton}
            type="button"
            onClick={() => {
              setName(selectedProfile?.name ?? '')
              setGender(selectedProfile?.gender ?? '')
              setCharacterClass(selectedProfile?.characterClass ?? 'Adventurer')
              setDescription(selectedProfile?.description ?? '')
              setBackgroundId(
                selectedProfile?.backgroundId ?? startingBackgroundId,
              )
              setTitleAchievementId(selectedProfile?.titleAchievementId ?? '')
              setChoosing(true)
            }}
          >
            Change character
          </button>
        </div>
      )}
    </section>
  )
}
