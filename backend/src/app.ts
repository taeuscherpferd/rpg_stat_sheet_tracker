import { createHash, randomBytes, randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import cors from 'cors'
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import swaggerUi from 'swagger-ui-express'
import {
  apiKeySchema,
  automationEntrySchema,
  entryUpdateSchema,
  focusSessionSchema,
  focusSettingsSchema,
  loginSchema,
  manualEntrySchema,
  profileUpdateSchema,
  registerSchema,
  skillInputSchema,
} from '@rlrpg/shared/contracts'
import { AppDatabase } from './database.js'
import { DomainError, LedgerService } from './LedgerService.js'
import { openApiDocument } from './openapi.js'

interface SessionRow {
  user_id: string
  username: string
  timezone: string
}

interface ApiIdentityRow {
  id: string
  user_id: string
  name: string
  preset: 'reader' | 'writer'
}

interface IdempotencyRow {
  payload_hash: string
  entry_id: string
}

interface UserRow {
  id: string
  username: string
  password_hash: string
  timezone: string
}

const hashToken = (value: string): string =>
  createHash('sha256').update(value).digest('hex')
const tokenFrom = (request: Request): string | null => {
  const authorization = request.header('authorization')
  return authorization?.startsWith('Bearer ') === true
    ? authorization.slice(7)
    : null
}
const routeParam = (request: Request, name: string): string => {
  const value = request.params[name]
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

const localDate = (timezone: string): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const value = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

const csvCell = (value: string | number | null): string => {
  if (value === null) return ''
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export const createApp = (
  database: AppDatabase,
  releaseId = process.env.RELEASE_ID ?? 'development',
) => {
  const app = express()
  const ledger = new LedgerService(database)
  const authLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 40,
    standardHeaders: true,
    legacyHeaders: false,
  })
  const automationLimiter = rateLimit({
    windowMs: 60_000,
    limit: 240,
    standardHeaders: true,
    legacyHeaders: false,
  })

  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(cors({ origin: true }))
  app.use(express.json({ limit: '256kb' }))

  app.get('/api/health', (_request, response) => {
    database.connection.prepare('SELECT 1').get()
    response.json({ status: 'ok', releaseId })
  })

  const requireSession = (
    request: Request,
    response: Response,
    next: NextFunction,
  ): void => {
    const token = tokenFrom(request)
    if (token === null) {
      response.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      })
      return
    }
    const session = database.connection
      .prepare(
        `
      SELECT s.user_id, u.username, u.timezone FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?
    `,
      )
      .get(hashToken(token), new Date().toISOString()) as SessionRow | undefined
    if (session === undefined) {
      response.status(401).json({
        error: { code: 'SESSION_EXPIRED', message: 'Session expired' },
      })
      return
    }
    response.locals.userId = session.user_id
    response.locals.username = session.username
    response.locals.timezone = session.timezone
    next()
  }

  const requireApiKey = (
    request: Request,
    response: Response,
    next: NextFunction,
  ): void => {
    const token = tokenFrom(request)
    if (token === null) {
      response.status(401).json({
        error: { code: 'API_KEY_REQUIRED', message: 'API key required' },
      })
      return
    }
    const identity = database.connection
      .prepare(
        `
      SELECT id, user_id, name, preset FROM api_keys
      WHERE token_hash = ? AND revoked_at IS NULL
    `,
      )
      .get(hashToken(token)) as ApiIdentityRow | undefined
    if (identity === undefined) {
      response.status(401).json({
        error: { code: 'INVALID_API_KEY', message: 'Invalid API key' },
      })
      return
    }
    database.connection
      .prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?')
      .run(new Date().toISOString(), identity.id)
    response.locals.apiIdentity = identity
    next()
  }

  const userId = (response: Response): string => String(response.locals.userId)
  const apiIdentity = (response: Response): ApiIdentityRow =>
    response.locals.apiIdentity as ApiIdentityRow

  app.post('/api/auth/register', authLimiter, (request, response) => {
    const input = registerSchema.parse(request.body)
    try {
      new Intl.DateTimeFormat('en', { timeZone: input.timezone })
    } catch {
      throw new DomainError('Invalid timezone')
    }
    const id = randomUUID()
    const now = new Date().toISOString()
    try {
      database.transaction(() => {
        database.connection
          .prepare(
            `
          INSERT INTO users (id, username, password_hash, timezone, created_at) VALUES (?, ?, ?, ?, ?)
        `,
          )
          .run(
            id,
            input.username,
            bcrypt.hashSync(input.password, 12),
            input.timezone,
            now,
          )
        database.connection
          .prepare('INSERT INTO focus_settings (user_id) VALUES (?)')
          .run(id)
      })
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE')) {
        throw new DomainError(
          'That username is already registered',
          409,
          'USERNAME_EXISTS',
        )
      }
      throw error
    }
    const token = createBrowserSession(database, id)
    response.status(201).json({
      token,
      user: { id, username: input.username, timezone: input.timezone },
    })
  })

  app.post('/api/auth/login', authLimiter, (request, response) => {
    const input = loginSchema.parse(request.body)
    const user = database.connection
      .prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE')
      .get(input.username) as UserRow | undefined
    if (
      user === undefined ||
      !bcrypt.compareSync(input.password, user.password_hash)
    ) {
      throw new DomainError(
        'Username or password is incorrect',
        401,
        'INVALID_CREDENTIALS',
      )
    }
    const token = createBrowserSession(database, user.id)
    response.json({
      token,
      user: { id: user.id, username: user.username, timezone: user.timezone },
    })
  })

  app.get('/api/auth/me', requireSession, (_request, response) => {
    response.json({
      id: userId(response),
      username: response.locals.username,
      timezone: response.locals.timezone,
    })
  })

  app.put('/api/auth/me', requireSession, (request, response) => {
    const input = profileUpdateSchema.parse(request.body)
    try {
      database.connection
        .prepare('UPDATE users SET username = ? WHERE id = ?')
        .run(input.username, userId(response))
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE')) {
        throw new DomainError(
          'That username is already registered',
          409,
          'USERNAME_EXISTS',
        )
      }
      throw error
    }
    response.json({
      id: userId(response),
      username: input.username,
      timezone: response.locals.timezone,
    })
  })

  app.post('/api/auth/logout', requireSession, (request, response) => {
    const token = tokenFrom(request)
    database.connection
      .prepare('DELETE FROM sessions WHERE token_hash = ?')
      .run(hashToken(token ?? ''))
    response.status(204).send()
  })

  app.get('/api/skills', requireSession, (request, response) => {
    response.json(
      database.listSkills(userId(response), request.query.archived !== 'false'),
    )
  })

  app.post('/api/skills', requireSession, (request, response) => {
    const input = skillInputSchema.parse(request.body)
    const id = ledger.createSkill(userId(response), input)
    response
      .status(201)
      .json(
        database.listSkills(userId(response)).find((skill) => skill.id === id),
      )
  })

  app.put('/api/skills/:skillId', requireSession, (request, response) => {
    const skillId = routeParam(request, 'skillId')
    ledger.updateSkill(
      userId(response),
      skillId,
      skillInputSchema.parse(request.body),
    )
    response.json(
      database
        .listSkills(userId(response))
        .find((skill) => skill.id === skillId),
    )
  })

  app.post(
    '/api/skills/:skillId/archive',
    requireSession,
    (request, response) => {
      ledger.setArchived(userId(response), routeParam(request, 'skillId'), true)
      response.status(204).send()
    },
  )

  app.post(
    '/api/skills/:skillId/restore',
    requireSession,
    (request, response) => {
      ledger.setArchived(
        userId(response),
        routeParam(request, 'skillId'),
        false,
      )
      response.status(204).send()
    },
  )

  app.get('/api/xp-entries', requireSession, (request, response) => {
    const skillId =
      typeof request.query.skillId === 'string'
        ? request.query.skillId
        : undefined
    response.json(database.listEntries(userId(response), skillId))
  })

  app.post('/api/xp-entries', requireSession, (request, response) => {
    response
      .status(201)
      .json(
        ledger.createEntry(
          userId(response),
          manualEntrySchema.parse(request.body),
          'manual',
          null,
        ),
      )
  })

  app.put('/api/xp-entries/:entryId', requireSession, (request, response) => {
    response.json(
      ledger.updateEntry(
        userId(response),
        routeParam(request, 'entryId'),
        entryUpdateSchema.parse(request.body),
      ),
    )
  })

  app.delete(
    '/api/xp-entries/:entryId',
    requireSession,
    (request, response) => {
      ledger.deleteEntry(userId(response), routeParam(request, 'entryId'))
      response.status(204).send()
    },
  )

  app.get('/api/activities', requireSession, (request, response) => {
    const skillId =
      typeof request.query.skillId === 'string' ? request.query.skillId : ''
    const rows = database.connection
      .prepare(
        `
      SELECT DISTINCT activity FROM xp_entries WHERE user_id = ? AND skill_id = ?
      AND activity IS NOT NULL AND activity != '' ORDER BY activity COLLATE NOCASE LIMIT 50
    `,
      )
      .all(userId(response), skillId) as { activity: string }[]
    response.json(rows.map((row) => row.activity))
  })

  app.get('/api/settings', requireSession, (_request, response) => {
    response.json(database.getSettings(userId(response)))
  })

  app.put('/api/settings', requireSession, (request, response) => {
    const settings = focusSettingsSchema.parse(request.body)
    ledger.updateSettings(userId(response), settings)
    response.json(settings)
  })

  app.post('/api/focus-sessions', requireSession, (request, response) => {
    const input = focusSessionSchema.parse(request.body)
    response
      .status(201)
      .json(ledger.createFocusEntry(userId(response), input, input.settings))
  })

  app.get('/api/api-keys', requireSession, (_request, response) =>
    response.json(database.listApiKeys(userId(response))),
  )

  app.post('/api/api-keys', requireSession, (request, response) => {
    const input = apiKeySchema.parse(request.body)
    const secret = randomBytes(24).toString('base64url')
    const prefix = randomBytes(4).toString('hex')
    const token = `rlrpg_${prefix}_${secret}`
    const id = randomUUID()
    database.connection
      .prepare(
        `
      INSERT INTO api_keys (id, user_id, name, prefix, token_hash, preset, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        id,
        userId(response),
        input.name,
        prefix,
        hashToken(token),
        input.preset,
        new Date().toISOString(),
      )
    response.status(201).json({
      token,
      apiKey: database
        .listApiKeys(userId(response))
        .find((key) => key.id === id),
    })
  })

  app.delete('/api/api-keys/:keyId', requireSession, (request, response) => {
    database.connection
      .prepare(
        `
      UPDATE api_keys SET revoked_at = ? WHERE id = ? AND user_id = ?
    `,
      )
      .run(
        new Date().toISOString(),
        routeParam(request, 'keyId'),
        userId(response),
      )
    response.status(204).send()
  })

  app.get('/api/exports/skills.csv', requireSession, (_request, response) => {
    const lines = [
      [
        'id',
        'code',
        'name',
        'emoji',
        'tags',
        'skill_color',
        'archived',
        'level',
        'total_xp',
        'links',
      ].join(','),
    ]
    for (const skill of database.listSkills(userId(response))) {
      lines.push(
        [
          skill.id,
          skill.code,
          skill.name,
          skill.emoji,
          skill.tags.join('|'),
          skill.headerColor,
          skill.archived ? 'yes' : 'no',
          skill.level,
          skill.totalXp,
          skill.links
            .map((link) => `${link.targetSkillName}:${link.percentage}%`)
            .join('|'),
        ]
          .map(csvCell)
          .join(','),
      )
    }
    response.type('text/csv').attachment('skills.csv').send(lines.join('\n'))
  })

  app.get(
    '/api/exports/xp-history.csv',
    requireSession,
    (_request, response) => {
      const lines = [
        [
          'id',
          'date',
          'skill',
          'code',
          'xp',
          'minutes',
          'activity',
          'notes',
          'source',
          'origin',
          'linked_awards',
          'rolls',
        ].join(','),
      ]
      const skills = database.listSkills(userId(response))
      for (const entry of database.listEntries(userId(response))) {
        const code =
          skills.find((skill) => skill.id === entry.skillId)?.code ?? ''
        const linked = entry.awards
          .filter((award) => award.kind === 'linked')
          .map((award) => `${award.skillName}:${award.amount}`)
          .join('|')
        lines.push(
          [
            entry.id,
            entry.date,
            entry.skillName,
            code,
            entry.xp,
            entry.minutes,
            entry.activity,
            entry.notes,
            entry.source,
            entry.origin,
            linked,
            entry.rolls.join('|'),
          ]
            .map(csvCell)
            .join(','),
        )
      }
      response
        .type('text/csv')
        .attachment('xp-history.csv')
        .send(lines.join('\n'))
    },
  )

  app.get('/api/openapi.json', (_request, response) =>
    response.json(openApiDocument),
  )
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument))

  const automation = express.Router()
  automation.use(automationLimiter, requireApiKey)
  automation.get('/skills', (request, response) => {
    const query =
      typeof request.query.q === 'string'
        ? request.query.q.toLocaleLowerCase()
        : ''
    const skills = database
      .listSkills(apiIdentity(response).user_id, false)
      .filter(
        (skill) =>
          query === '' ||
          skill.name.toLocaleLowerCase().includes(query) ||
          skill.code.toLocaleLowerCase() === query ||
          skill.tags.some((tag) => tag.toLocaleLowerCase().includes(query)),
      )
    response.json(skills)
  })
  automation.get('/skills/:skillId', (request, response) => {
    const skill = database
      .listSkills(apiIdentity(response).user_id, false)
      .find((candidate) => candidate.id === request.params.skillId)
    if (skill === undefined)
      throw new DomainError('Skill not found', 404, 'SKILL_NOT_FOUND')
    response.json(skill)
  })
  automation.post('/xp-entries', (request, response) => {
    const identity = apiIdentity(response)
    if (identity.preset !== 'writer')
      throw new DomainError(
        'This API key cannot write XP',
        403,
        'INSUFFICIENT_SCOPE',
      )
    const input = automationEntrySchema.parse(request.body)
    const skills = database.listSkills(identity.user_id, false)
    const skill = skills.find(
      (candidate) =>
        candidate.id === input.skillId || candidate.code === input.skillCode,
    )
    if (skill === undefined)
      throw new DomainError('Active skill not found', 404, 'SKILL_NOT_FOUND')
    const payload = {
      ...input,
      skillId: skill.id,
      date: input.date ?? userDate(database, identity.user_id),
    }
    const idempotencyKey = request.header('idempotency-key')
    const payloadHash = hashToken(JSON.stringify(payload))
    if (idempotencyKey !== undefined) {
      if (idempotencyKey.length > 200)
        throw new DomainError('Idempotency key is too long')
      const existing = database.connection
        .prepare(
          `
        SELECT payload_hash, entry_id FROM idempotency_records WHERE api_key_id = ? AND idempotency_key = ?
      `,
        )
        .get(identity.id, idempotencyKey) as IdempotencyRow | undefined
      if (existing !== undefined) {
        if (existing.payload_hash !== payloadHash) {
          throw new DomainError(
            'Idempotency key was used with another payload',
            409,
            'IDEMPOTENCY_CONFLICT',
          )
        }
        response.json(
          database
            .listEntries(identity.user_id)
            .find((entry) => entry.id === existing.entry_id),
        )
        return
      }
    }
    const entry = ledger.createEntry(
      identity.user_id,
      payload,
      'automation',
      identity.name,
    )
    if (idempotencyKey !== undefined) {
      database.connection
        .prepare(
          `
        INSERT INTO idempotency_records (api_key_id, idempotency_key, payload_hash, entry_id) VALUES (?, ?, ?, ?)
      `,
        )
        .run(identity.id, idempotencyKey, payloadHash, entry.id)
    }
    response.status(201).json(entry)
  })
  automation.get('/xp-entries/:entryId', (request, response) => {
    const identity = apiIdentity(response)
    const entry = database
      .listEntries(identity.user_id)
      .find(
        (candidate) =>
          candidate.id === request.params.entryId &&
          candidate.source === 'automation' &&
          candidate.origin === identity.name,
      )
    if (entry === undefined)
      throw new DomainError('Entry not found', 404, 'ENTRY_NOT_FOUND')
    response.json(entry)
  })
  app.use('/api/v1/automation', automation)

  const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
  const frontendDist = path.resolve(currentDirectory, '../../frontend/dist')
  app.use(express.static(frontendDist))
  app.get('*path', (request, response, next) => {
    if (request.path.startsWith('/api/')) return next()
    response.sendFile(path.join(frontendDist, 'index.html'))
  })

  app.use(
    (
      error: Error,
      _request: Request,
      response: Response,
      _next: NextFunction,
    ) => {
      if (error instanceof DomainError) {
        response
          .status(error.status)
          .json({ error: { code: error.code, message: error.message } })
        return
      }
      if (error.name === 'ZodError') {
        response.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
          },
        })
        return
      }
      console.error(error)
      response.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' },
      })
    },
  )

  return app
}

const createBrowserSession = (
  database: AppDatabase,
  userId: string,
): string => {
  const token = randomBytes(32).toString('base64url')
  const now = new Date()
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60_000)
  database.connection
    .prepare(
      `
    INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)
  `,
    )
    .run(
      randomUUID(),
      userId,
      hashToken(token),
      expires.toISOString(),
      now.toISOString(),
    )
  return token
}

const userDate = (database: AppDatabase, userId: string): string => {
  const user = database.connection
    .prepare('SELECT timezone FROM users WHERE id = ?')
    .get(userId) as { timezone: string }
  return localDate(user.timezone)
}
