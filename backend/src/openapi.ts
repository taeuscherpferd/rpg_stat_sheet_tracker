import { z } from 'zod'
import { skillInputSchema } from '@rlrpg/shared/contracts'

const { name, emoji, tags } = skillInputSchema.shape
const trimmedSkillStrings = new Set<z.core.$ZodType>([
  name,
  emoji.unwrap().unwrap(),
  tags.removeDefault().element,
])

const skillInputJsonSchema = z.toJSONSchema(skillInputSchema, {
  io: 'input',
  override: ({ zodSchema, jsonSchema }) => {
    if (
      !trimmedSkillStrings.has(zodSchema) ||
      jsonSchema.maxLength === undefined
    )
      return

    const { minLength = 0, maxLength } = jsonSchema
    delete jsonSchema.minLength
    delete jsonSchema.maxLength
    jsonSchema.description = `The server trims this value with JavaScript String.prototype.trim() and requires ${minLength}–${maxLength} UTF-16 code units after trimming.`
  },
})

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'RLRPG Automation API',
    version: '1.2.0',
    description:
      'Discover and create fully configured skills, query complete XP history, and award XP from scripts or digital assistants. Reader and writer keys can read all history belonging to their user. Dates are inclusive calendar dates in the user timezone.',
  },
  servers: [{ url: '/api/v1/automation' }],
  components: {
    securitySchemes: {
      apiKey: { type: 'http', scheme: 'bearer', bearerFormat: 'RLRPG API key' },
    },
    schemas: {
      SkillInput: skillInputJsonSchema,
      Skill: {
        type: 'object',
        required: [
          'id',
          'name',
          'code',
          'emoji',
          'tags',
          'headerColor',
          'archived',
          'totalXp',
          'level',
          'levelXp',
          'nextLevelXp',
          'links',
        ],
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          code: { type: 'string' },
          emoji: { type: ['string', 'null'] },
          tags: { type: 'array', items: { type: 'string' } },
          headerColor: { type: 'string' },
          archived: { type: 'boolean' },
          totalXp: { type: 'integer' },
          level: { type: 'integer' },
          levelXp: { type: 'integer' },
          nextLevelXp: { type: 'integer' },
          links: {
            type: 'array',
            items: {
              type: 'object',
              required: ['targetSkillId', 'targetSkillName', 'percentage'],
              properties: {
                targetSkillId: { type: 'string', format: 'uuid' },
                targetSkillName: { type: 'string' },
                percentage: { type: 'integer' },
              },
            },
          },
        },
      },
      XpEntry: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          skillId: { type: 'string', format: 'uuid' },
          skillName: { type: 'string' },
          date: { type: 'string', format: 'date' },
          xp: { type: 'integer' },
          minutes: { type: ['integer', 'null'] },
          activity: { type: ['string', 'null'] },
          notes: { type: ['string', 'null'] },
          source: {
            type: 'string',
            enum: ['manual', 'focus', 'automation', 'achievement'],
          },
          origin: { type: ['string', 'null'] },
          createdAt: { type: 'string', format: 'date-time' },
          awards: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                skillId: { type: 'string' },
                skillName: { type: 'string' },
                amount: { type: 'integer' },
                kind: { type: 'string', enum: ['direct', 'linked'] },
                percentage: { type: ['integer', 'null'] },
              },
            },
          },
          rolls: { type: 'array', items: { type: 'integer' } },
        },
      },
      AutomationEntry: {
        type: 'object',
        required: ['xp'],
        properties: {
          skillId: { type: 'string', format: 'uuid' },
          skillCode: {
            type: 'string',
            pattern: '^[A-Z0-9]{3}$',
            example: 'KOR',
          },
          xp: { type: 'integer', minimum: 1, example: 50 },
          date: { type: 'string', format: 'date' },
          minutes: { type: ['integer', 'null'], minimum: 1 },
          activity: {
            type: ['string', 'null'],
            example: 'Anki deck completion',
          },
          notes: { type: ['string', 'null'] },
        },
        oneOf: [{ required: ['skillId'] }, { required: ['skillCode'] }],
      },
    },
  },
  security: [{ apiKey: [] }],
  paths: {
    '/skills': {
      post: {
        operationId: 'createSkill',
        summary: 'Create a fully configured skill (writer key required)',
        description:
          'Creates an active skill owned by the API key user. Name and code are required. Codes are unique per user, including archived skills. Tags must be unique ignoring case. Up to three distinct links may target existing active skills owned by the same user; use listSkills to find their IDs. headerColor sets both header and XP bar color. startingLevel defaults to 1 and initializes progression without creating an XP history entry or awarding linked XP. Repeated requests with the same code return 409; this endpoint does not support Idempotency-Key.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SkillInput' },
            },
          },
        },
        responses: {
          '201': {
            description:
              'Created skill with its ID, configuration, and progression',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Skill' },
              },
            },
          },
          '400': { description: 'Invalid skill settings or duplicate links' },
          '401': { description: 'Missing, invalid, or revoked API key' },
          '403': {
            description: 'Writer API key required (INSUFFICIENT_SCOPE)',
          },
          '404': {
            description: 'Linked skill not found or owned by another user',
          },
          '409': {
            description: 'Code already exists or linked skill is archived',
          },
          '429': { description: 'Automation rate limit exceeded' },
        },
      },
      get: {
        operationId: 'listSkills',
        summary: 'List active skills and current progression',
        parameters: [{ name: 'q', in: 'query', schema: { type: 'string' } }],
        responses: { '200': { description: 'Skills visible to this API key' } },
      },
    },
    '/skills/{skillId}': {
      get: {
        operationId: 'getSkill',
        summary: 'Get one skill by stable UUID',
        parameters: [
          {
            name: 'skillId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': { description: 'Skill progression' },
          '404': { description: 'Skill not found' },
        },
      },
    },
    '/xp-entries': {
      get: {
        operationId: 'queryXpHistory',
        summary:
          'Query XP history from all sources, with totals and latest practice date',
        description:
          'Includes archived skills and linked XP. Results are newest first. totalXp covers all matching entries, independent of pagination; for a skill filter it counts only awards to that skill. totalMinutes and latestPracticeDate count direct practice only. Achievement rewards are excluded from latestPracticeDate. Follow nextOffset until null for all entries.',
        parameters: [
          {
            name: 'skillId',
            in: 'query',
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'skillCode',
            in: 'query',
            schema: { type: 'string', pattern: '^[A-Z0-9]{3}$' },
          },
          {
            name: 'from',
            in: 'query',
            schema: { type: 'string', format: 'date' },
            description: 'Inclusive start date',
          },
          {
            name: 'to',
            in: 'query',
            schema: { type: 'string', format: 'date' },
            description:
              'Inclusive end date; use the same from and to for one day',
          },
          {
            name: 'activity',
            in: 'query',
            schema: { type: 'string' },
            description: 'Case insensitive activity substring',
          },
          {
            name: 'source',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['manual', 'focus', 'automation', 'achievement'],
            },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 500, default: 100 },
          },
          {
            name: 'offset',
            in: 'query',
            schema: { type: 'integer', minimum: 0, default: 0 },
          },
        ],
        responses: {
          '200': {
            description: 'History page and totals',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    entries: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/XpEntry' },
                    },
                    total: { type: 'integer' },
                    totalXp: { type: 'integer' },
                    totalMinutes: { type: 'integer' },
                    latestPracticeDate: {
                      type: ['string', 'null'],
                      format: 'date',
                    },
                    limit: { type: 'integer' },
                    offset: { type: 'integer' },
                    nextOffset: { type: ['integer', 'null'] },
                    timezone: { type: 'string' },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid filters' },
          '404': { description: 'Skill not found' },
        },
      },
      post: {
        operationId: 'addXp',
        summary: 'Award XP to an active skill',
        parameters: [
          {
            name: 'Idempotency-Key',
            in: 'header',
            schema: { type: 'string', maxLength: 200 },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AutomationEntry' },
            },
          },
        },
        responses: {
          '201': { description: 'XP entry created' },
          '200': { description: 'Previously created idempotent entry' },
          '409': {
            description: 'Idempotency key reused with a different payload',
          },
        },
      },
    },
    '/xp-entries/{entryId}': {
      get: {
        operationId: 'getXpEntry',
        summary: 'Get any XP entry belonging to this user',
        parameters: [
          {
            name: 'entryId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'XP entry',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/XpEntry' },
              },
            },
          },
          '404': { description: 'Entry not found' },
        },
      },
    },
  },
} as const
