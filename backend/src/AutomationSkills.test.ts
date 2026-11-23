import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { AppDatabase } from './database.js'
import { createApp } from './app.js'
import { ProgressionLogic } from './Progression.logic.js'

describe('automation skill creation', () => {
  let database: AppDatabase
  let app: ReturnType<typeof createApp>
  let sessionToken: string
  let writerToken: string
  let ownerId: string
  const endpoint = '/api/v1/automation/skills'
  const basicSkill = { name: 'Korean', code: 'KOR' }

  beforeEach(async () => {
    database = new AppDatabase(':memory:')
    app = createApp(database)
    const registration = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'adventurer',
        password: 'long-password',
        timezone: 'America/Denver',
      })
      .expect(201)
    sessionToken = registration.body.token as string
    const profile = await request(app)
      .get('/api/auth/me')
      .auth(sessionToken, { type: 'bearer' })
      .expect(200)
    ownerId = profile.body.id as string
    const key = await request(app)
      .post('/api/api-keys')
      .auth(sessionToken, { type: 'bearer' })
      .send({ name: 'Agent', preset: 'writer' })
      .expect(201)
    writerToken = key.body.token as string
  })
  afterEach(() => database.close())

  const createSkill = (payload: object, token = writerToken) =>
    request(app).post(endpoint).auth(token, { type: 'bearer' }).send(payload)

  it('persists every setting, exposes it to both APIs, and uses links for subsequent XP', async () => {
    const target = await createSkill({ name: 'Languages', code: 'LNG' }).expect(
      201,
    )
    const input = {
      ...basicSkill,
      emoji: '🇰🇷',
      tags: ['language', 'study'],
      headerColor: '#abcdef',
      startingLevel: 42,
      links: [{ targetSkillId: target.body.id as string, percentage: 30 }],
    }
    const created = await createSkill(input).expect(201)
    expect(created.body).toMatchObject({
      ...basicSkill,
      emoji: input.emoji,
      tags: input.tags,
      headerColor: input.headerColor,
      archived: false,
      level: 42,
      totalXp: ProgressionLogic.totalXpForLevel(42),
      levelXp: 0,
      links: [{ ...input.links[0], targetSkillName: 'Languages' }],
    })
    expect(database.listEntries(ownerId)).toEqual([])
    expect(
      database.listSkills(ownerId).find((skill) => skill.id === target.body.id)
        ?.totalXp,
    ).toBe(0)
    const fetched = await request(app)
      .get(`${endpoint}/${created.body.id as string}`)
      .auth(writerToken, { type: 'bearer' })
      .expect(200)
    expect(fetched.body).toEqual(created.body)
    const browserSkills = await request(app)
      .get('/api/skills')
      .auth(sessionToken, { type: 'bearer' })
      .expect(200)
    expect(browserSkills.body).toContainEqual(created.body)
    const award = await request(app)
      .post('/api/v1/automation/xp-entries')
      .auth(writerToken, { type: 'bearer' })
      .send({ skillCode: 'KOR', xp: 100 })
      .expect(201)
    expect(award.body.awards).toContainEqual(
      expect.objectContaining({
        skillId: target.body.id,
        amount: 30,
        kind: 'linked',
      }),
    )
  })

  it('applies defaults and rejects duplicate codes without altering the original skill', async () => {
    const created = await createSkill(basicSkill).expect(201)
    expect(created.body).toMatchObject({
      emoji: null,
      tags: [],
      headerColor: '#334b3f',
      level: 1,
      totalXp: 0,
      links: [],
      archived: false,
    })
    const duplicate = await createSkill({
      ...basicSkill,
      name: 'Replacement',
    }).expect(409)
    expect(duplicate.body.error.code).toBe('CODE_EXISTS')
    expect(database.listSkills(ownerId)).toEqual([created.body])
  })

  it('requires a valid writer key and rejects session tokens and revoked keys', async () => {
    await request(app).post(endpoint).send(basicSkill).expect(401)
    await createSkill(basicSkill, 'invalid').expect(401)
    await createSkill(basicSkill, sessionToken).expect(401)
    const reader = await request(app)
      .post('/api/api-keys')
      .auth(sessionToken, { type: 'bearer' })
      .send({ name: 'Reader', preset: 'reader' })
      .expect(201)
    const forbidden = await createSkill(
      basicSkill,
      reader.body.token as string,
    ).expect(403)
    expect(forbidden.body.error.code).toBe('INSUFFICIENT_SCOPE')
    database.connection
      .prepare('UPDATE api_keys SET revoked_at = ?')
      .run(new Date().toISOString())
    await createSkill(basicSkill).expect(401)
    expect(database.listSkills(ownerId)).toEqual([])
  })

  it('rejects invalid settings without writing a skill', async () => {
    const invalidSettings = [
      { name: ' ' },
      { code: 'kor' },
      { emoji: 'x'.repeat(17) },
      { tags: ['Study', 'study'] },
      { tags: [''] },
      { tags: Array.from({ length: 9 }, (_, index) => `tag${index}`) },
      { headerColor: 'red' },
      { startingLevel: 0 },
      { startingLevel: 10000 },
      { startingLevel: 1.5 },
      { links: [{ targetSkillId: 'invalid', percentage: 20 }] },
      { links: [{ targetSkillId: randomUUID(), percentage: 31 }] },
      { links: [{ targetSkillId: randomUUID(), percentage: 0 }] },
      {
        links: Array.from({ length: 4 }, () => ({
          targetSkillId: randomUUID(),
          percentage: 10,
        })),
      },
    ]
    for (const settings of invalidSettings) {
      const response = await createSkill({ ...basicSkill, ...settings }).expect(
        400,
      )
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    }
    expect(database.listSkills(ownerId)).toEqual([])
  })

  it('rejects duplicate, missing, archived, and foreign links without partial writes', async () => {
    const target = await createSkill({ name: 'Languages', code: 'LNG' }).expect(
      201,
    )
    const link = { targetSkillId: target.body.id as string, percentage: 20 }
    await createSkill({ ...basicSkill, links: [link, link] }).expect(400)
    await createSkill({
      ...basicSkill,
      links: [{ ...link, targetSkillId: randomUUID() }],
    }).expect(404)
    await request(app)
      .post(`/api/skills/${link.targetSkillId}/archive`)
      .auth(sessionToken, { type: 'bearer' })
      .expect(204)
    await createSkill({ ...basicSkill, links: [link] }).expect(409)
    const other = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'other',
        password: 'long-password',
        timezone: 'UTC',
      })
      .expect(201)
    const foreign = await request(app)
      .post('/api/skills')
      .auth(other.body.token as string, { type: 'bearer' })
      .send(basicSkill)
      .expect(201)
    await createSkill({
      ...basicSkill,
      links: [{ ...link, targetSkillId: foreign.body.id as string }],
    }).expect(404)
    expect(database.listSkills(ownerId)).toHaveLength(1)
    await createSkill(basicSkill).expect(201)
  })

  it('publishes the complete creation contract', async () => {
    const document = await request(app).get('/api/openapi.json').expect(200)
    expect(document.body.paths['/skills'].post.operationId).toBe('createSkill')
    expect(
      Object.keys(document.body.components.schemas.SkillInput.properties),
    ).toEqual([
      'name',
      'code',
      'emoji',
      'tags',
      'headerColor',
      'startingLevel',
      'links',
    ])
    expect(document.body.components.schemas.SkillInput.required).toEqual([
      'name',
      'code',
    ])
  })
})
