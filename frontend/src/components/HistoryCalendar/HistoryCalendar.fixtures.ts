import type { SkillResponse, XpEntryResponse } from '@rlrpg/shared/contracts'

export const calendarSkills: SkillResponse[] = [
  {
    id: 'archery',
    name: 'Archery',
    code: 'ARC',
    emoji: '🏹',
    tags: [],
    headerColor: '#334b3f',
    archived: false,
    totalXp: 100,
    level: 1,
    levelXp: 100,
    nextLevelXp: 300,
    links: [],
  },
  {
    id: 'music',
    name: 'Music',
    code: 'MUS',
    emoji: '🎵',
    tags: [],
    headerColor: '#334b3f',
    archived: false,
    totalXp: 25,
    level: 1,
    levelXp: 25,
    nextLevelXp: 300,
    links: [],
  },
]

export const calendarEntry = (
  overrides: Partial<XpEntryResponse> = {},
): XpEntryResponse => ({
  id: 'entry-1',
  skillId: 'archery',
  skillName: 'Archery',
  date: '2026-11-23',
  xp: 100,
  minutes: 25,
  activity: 'Target practice',
  notes: 'A good session',
  source: 'manual',
  origin: null,
  createdAt: '2026-11-23T12:00:00Z',
  rolls: [],
  awards: [
    {
      skillId: 'archery',
      skillName: 'Archery',
      amount: 100,
      kind: 'direct',
      percentage: null,
    },
  ],
  ...overrides,
})
