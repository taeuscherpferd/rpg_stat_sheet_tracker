import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { AppDatabase } from './database.js'
import { createApp } from './app.js'

describe('RLRPG API', () => {
  let database: AppDatabase
  beforeEach(() => {
    database = new AppDatabase(':memory:')
  })
  afterEach(() => database.close())

  const register = async () => {
    const response = await request(createApp(database))
      .post('/api/auth/register')
      .send({
        username: 'adventurer',
        password: 'long-password',
        timezone: 'America/Denver',
      })
    expect(response.status).toBe(201)
    return { app: createApp(database), token: response.body.token as string }
  }

  it('reports database readiness and the active release', async () => {
    const response = await request(createApp(database, 'release-abc')).get(
      '/api/health',
    )

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok', releaseId: 'release-abc' })
  })

  it('awards direct and one-hop linked XP', async () => {
    const { app, token } = await register()
    const authorization = { Authorization: `Bearer ${token}` }
    const music = await request(app)
      .post('/api/skills')
      .set(authorization)
      .send({ name: 'Music', code: 'MUS', links: [] })
    const guitar = await request(app)
      .post('/api/skills')
      .set(authorization)
      .send({
        name: 'Guitar',
        code: 'GTR',
        links: [{ targetSkillId: music.body.id, percentage: 25 }],
      })
    const entry = await request(app)
      .post('/api/xp-entries')
      .set(authorization)
      .send({
        skillId: guitar.body.id,
        date: '2026-07-15',
        xp: 51,
        minutes: 20,
        activity: 'Scales',
        notes: null,
      })
    expect(entry.status).toBe(201)
    expect(
      entry.body.awards.map((award: { amount: number }) => award.amount),
    ).toEqual([51, 12])
  })

  it('starts an imported skill at the selected level without a history entry', async () => {
    const { app, token } = await register()
    const authorization = { Authorization: `Bearer ${token}` }
    const skill = await request(app)
      .post('/api/skills')
      .set(authorization)
      .send({ name: 'Woodworking', code: 'WDW', startingLevel: 42, links: [] })

    expect(skill.status).toBe(201)
    expect(skill.body).toMatchObject({ level: 42, levelXp: 0 })

    const history = await request(app).get('/api/xp-entries').set(authorization)
    expect(history.body).toEqual([])
  })

  it('creates and edits skill tags and color', async () => {
    const { app, token } = await register()
    const authorization = { Authorization: `Bearer ${token}` }
    const created = await request(app)
      .post('/api/skills')
      .set(authorization)
      .send({
        name: 'Painting',
        code: 'PNT',
        tags: ['creative', 'visual'],
        headerColor: '#6b3fa0',
        xpBarColor: '#d58b2d',
        links: [],
      })

    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({
      tags: ['creative', 'visual'],
      headerColor: '#6b3fa0',
    })
    expect(created.body).not.toHaveProperty('xpBarColor')
    expect(
      database.connection
        .prepare('SELECT xp_bar_color FROM skills WHERE id = ?')
        .get(created.body.id as string),
    ).toMatchObject({ xp_bar_color: '#6b3fa0' })

    const updated = await request(app)
      .put(`/api/skills/${created.body.id as string}`)
      .set(authorization)
      .send({
        name: 'Painting',
        code: 'PNT',
        tags: ['art'],
        headerColor: '#123456',
        xpBarColor: '#abcdef',
        links: [],
      })

    expect(updated.status).toBe(200)
    expect(updated.body).toMatchObject({
      tags: ['art'],
      headerColor: '#123456',
    })
    expect(updated.body).not.toHaveProperty('xpBarColor')
    expect(
      database.connection
        .prepare('SELECT xp_bar_color FROM skills WHERE id = ?')
        .get(created.body.id as string),
    ).toMatchObject({ xp_bar_color: '#123456' })
  })

  it('updates a username and prevents duplicate usernames', async () => {
    const { app, token } = await register()
    const authorization = { Authorization: `Bearer ${token}` }

    const updated = await request(app)
      .put('/api/auth/me')
      .set(authorization)
      .send({ username: 'pathfinder' })
    expect(updated.status).toBe(200)
    expect(updated.body).toMatchObject({ username: 'pathfinder' })

    const currentUser = await request(app)
      .get('/api/auth/me')
      .set(authorization)
    expect(currentUser.body).toMatchObject({ username: 'pathfinder' })

    await request(app).post('/api/auth/register').send({
      username: 'cartographer',
      password: 'another-password',
      timezone: 'America/Denver',
    })
    const duplicate = await request(app)
      .put('/api/auth/me')
      .set(authorization)
      .send({ username: 'CARTOGRAPHER' })
    expect(duplicate.status).toBe(409)
    expect(duplicate.body.error.code).toBe('USERNAME_EXISTS')
  })

  it('supports scoped, idempotent automation XP', async () => {
    const { app, token } = await register()
    const authorization = { Authorization: `Bearer ${token}` }
    await request(app)
      .post('/api/skills')
      .set(authorization)
      .send({ name: 'Korean', code: 'KOR', links: [] })
    const keyResponse = await request(app)
      .post('/api/api-keys')
      .set(authorization)
      .send({ name: 'Anki', preset: 'writer' })
    const apiAuthorization = {
      Authorization: `Bearer ${keyResponse.body.token as string}`,
      'Idempotency-Key': 'deck-42',
    }
    const payload = {
      skillCode: 'KOR',
      xp: 50,
      activity: 'Anki deck completion',
    }
    const created = await request(app)
      .post('/api/v1/automation/xp-entries')
      .set(apiAuthorization)
      .send(payload)
    const replayed = await request(app)
      .post('/api/v1/automation/xp-entries')
      .set(apiAuthorization)
      .send(payload)
    const conflict = await request(app)
      .post('/api/v1/automation/xp-entries')
      .set(apiAuthorization)
      .send({ ...payload, xp: 51 })
    expect(created.status).toBe(201)
    expect(replayed.status).toBe(200)
    expect(replayed.body.id).toBe(created.body.id)
    expect(conflict.status).toBe(409)
  })
})
