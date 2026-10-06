export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'RLRPG Automation API',
    version: '1.1.0',
    description:
      'Discover skills, query complete XP history, and award XP from scripts or digital assistants. Reader and writer keys can read all history belonging to their user. Dates are inclusive calendar dates in the user timezone.',
  },
  servers: [{ url: '/api/v1/automation' }],
  components: {
    securitySchemes: {
      apiKey: { type: 'http', scheme: 'bearer', bearerFormat: 'RLRPG API key' },
    },
    schemas: {
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
