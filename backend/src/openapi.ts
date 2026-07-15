export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'RLRPG Automation API',
    version: '1.0.0',
    description:
      'Discover skills and award XP from scripts or digital assistants.',
  },
  servers: [{ url: '/api/v1/automation' }],
  components: {
    securitySchemes: {
      apiKey: { type: 'http', scheme: 'bearer', bearerFormat: 'RLRPG API key' },
    },
    schemas: {
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
        operationId: 'getAutomationEntry',
        summary: 'Get an entry created by this API key',
        parameters: [
          {
            name: 'entryId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': { description: 'XP entry' },
          '404': { description: 'Entry not found' },
        },
      },
    },
  },
} as const
