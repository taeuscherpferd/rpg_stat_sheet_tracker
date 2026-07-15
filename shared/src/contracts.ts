import { z } from 'zod'

export const skillCodeSchema = z.string().regex(/^[A-Z0-9]{3}$/)
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const registerSchema = z.object({
  username: z.string().trim().min(3).max(40),
  password: z.string().min(8).max(200),
  timezone: z.string().min(1).max(100),
})

export const loginSchema = registerSchema.pick({
  username: true,
  password: true,
})

export const profileUpdateSchema = registerSchema.pick({
  username: true,
})

export const skillLinkInputSchema = z.object({
  targetSkillId: z.string().uuid(),
  percentage: z.number().int().min(1).max(30),
})

export const skillColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/)

const skillTagsSchema = z
  .array(z.string().trim().min(1).max(24))
  .max(8)
  .refine(
    (tags) =>
      new Set(tags.map((tag) => tag.toLocaleLowerCase())).size === tags.length,
    { message: 'Tags must be unique' },
  )

export const skillInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  code: skillCodeSchema,
  emoji: z.string().trim().max(16).nullable().optional(),
  tags: skillTagsSchema.default([]),
  headerColor: skillColorSchema.default('#334b3f'),
  startingLevel: z.number().int().min(1).max(9999).optional(),
  links: z.array(skillLinkInputSchema).max(3).default([]),
})

export const manualEntrySchema = z.object({
  skillId: z.string().uuid(),
  date: dateSchema,
  xp: z.number().int().positive().max(1_000_000),
  minutes: z.number().int().positive().max(100_000).nullable().optional(),
  activity: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
})

export const automationEntrySchema = manualEntrySchema
  .omit({ skillId: true, date: true })
  .extend({
    skillId: z.string().uuid().optional(),
    skillCode: skillCodeSchema.optional(),
    date: dateSchema.optional(),
  })
  .refine(
    (value) => value.skillId !== undefined || value.skillCode !== undefined,
    {
      message: 'skillId or skillCode is required',
    },
  )

export const focusSettingsSchema = z.object({
  intervalMinutes: z.number().int().min(1).max(240),
  baseXp: z.number().int().min(1).max(100_000),
  normalPercentPerPip: z.number().int().min(0).max(100),
  naturalOneBonusPercent: z.number().int().min(0).max(500),
  naturalTwentyBonusPercent: z.number().int().min(0).max(500),
})

export const focusSessionSchema = z.object({
  skillId: z.string().uuid(),
  date: dateSchema,
  focusedSeconds: z.number().int().positive(),
  rolls: z.array(z.number().int().min(1).max(20)).min(1),
  notes: z.string().trim().max(4000).nullable().optional(),
  settings: focusSettingsSchema,
})

export const apiKeySchema = z.object({
  name: z.string().trim().min(1).max(80),
  preset: z.enum(['reader', 'writer']),
})

export const entryUpdateSchema = manualEntrySchema.omit({ skillId: true })

export interface UserResponse {
  id: string
  username: string
  timezone: string
}

export interface SkillLinkResponse {
  targetSkillId: string
  targetSkillName: string
  percentage: number
}

export interface SkillResponse {
  id: string
  name: string
  code: string
  emoji: string | null
  tags: string[]
  headerColor: string
  archived: boolean
  totalXp: number
  level: number
  levelXp: number
  nextLevelXp: number
  links: SkillLinkResponse[]
}

export interface XpAwardResponse {
  skillId: string
  skillName: string
  amount: number
  kind: 'direct' | 'linked'
  percentage: number | null
}

export interface XpEntryResponse {
  id: string
  skillId: string
  skillName: string
  date: string
  xp: number
  minutes: number | null
  activity: string | null
  notes: string | null
  source: 'manual' | 'focus' | 'automation'
  origin: string | null
  createdAt: string
  awards: XpAwardResponse[]
  rolls: number[]
}

export type FocusSettings = z.infer<typeof focusSettingsSchema>

export interface ApiKeyResponse {
  id: string
  name: string
  prefix: string
  preset: 'reader' | 'writer'
  createdAt: string
  lastUsedAt: string | null
}
