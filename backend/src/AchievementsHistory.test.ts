import { afterEach, beforeEach, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { AppDatabase } from './database.js'

let database: AppDatabase
beforeEach(() => {
  database = new AppDatabase(':memory:')
})
afterEach(() => database.close())

const setup = async (username = 'adventurer') => {
  const app = createApp(database)
  const registered = await request(app)
    .post('/api/auth/register')
    .send({ username, password: 'long-password', timezone: 'America/Denver' })
  const auth = { Authorization: `Bearer ${registered.body.token}` }
  const skill = await request(app)
    .post('/api/skills')
    .set(auth)
    .send({ name: 'Marksmanship', code: 'MRK' })
  const key = await request(app)
    .post('/api/api-keys')
    .set(auth)
    .send({ name: 'History reader', preset: 'reader' })
  return {
    app,
    auth,
    skillId: skill.body.id as string,
    reader: { Authorization: `Bearer ${key.body.token}` },
  }
}

it('obtains once, snapshots linked rewards, and undoes through the XP ledger', async () => {
  const { app, auth, skillId } = await setup()
  const linked = await request(app)
    .post('/api/skills')
    .set(auth)
    .send({
      name: 'Archery',
      code: 'ARC',
      links: [{ targetSkillId: skillId, percentage: 20 }],
    })
  const achievement = await request(app)
    .post(`/api/skills/${linked.body.id}/achievements`)
    .set(auth)
    .send({ name: 'First bullseye', xp: 100, bonusAward: 'New arrows' })
  expect(achievement.status).toBe(201)
  const stateUrl = `/api/achievements/${achievement.body.id}/obtained`
  for (let i = 0; i < 2; i++) {
    expect(
      (
        await request(app)
          .put(stateUrl)
          .set(auth)
          .send({ obtained: true, date: '2026-10-05' })
      ).status,
    ).toBe(204)
  }
  const history = await request(app)
    .get(`/api/xp-entries?skillId=${skillId}`)
    .set(auth)
  expect(history.body).toHaveLength(1)
  expect(history.body[0]).toMatchObject({ source: 'achievement', xp: 100 })
  expect(
    history.body[0].awards.map((a: { amount: number }) => a.amount),
  ).toEqual([100, 20])
  const entryId = history.body[0].id
  expect(
    (
      await request(app)
        .put(`/api/xp-entries/${entryId}`)
        .set(auth)
        .send({ date: '2026-10-05', xp: 50 })
    ).status,
  ).toBe(409)
  expect(
    (await request(app).delete(`/api/xp-entries/${entryId}`).set(auth)).status,
  ).toBe(204)
  expect(
    (await request(app).get('/api/achievements').set(auth)).body[0]
      .earnedEntryId,
  ).toBeNull()
  expect(
    database
      .listSkills(
        database.connection.prepare('SELECT id FROM users').get()!.id as string,
      )
      .map((s) => s.totalXp),
  ).toEqual([0, 0])
  await request(app).put(stateUrl).set(auth).send({ obtained: true })
  await request(app).put(stateUrl).set(auth).send({ obtained: false })
  expect((await request(app).get('/api/xp-entries').set(auth)).body).toEqual([])
})

it('logs and undoes achievements with no XP reward', async () => {
  const { app, auth, skillId } = await setup()
  const achievement = await request(app)
    .post(`/api/skills/${skillId}/achievements`)
    .set(auth)
    .send({ name: 'Milestone' })
  await request(app)
    .put(`/api/achievements/${achievement.body.id}/obtained`)
    .set(auth)
    .send({ obtained: true })
  expect(
    (await request(app).get('/api/xp-entries').set(auth)).body[0],
  ).toMatchObject({ xp: 0, source: 'achievement' })
})

it('allows reader keys to query all sources with complete totals, dates and pagination', async () => {
  const { app, auth, skillId, reader } = await setup()
  for (const date of ['2026-10-04', '2026-10-05', '2026-10-05']) {
    await request(app).post('/api/xp-entries').set(auth).send({
      skillId,
      date,
      xp: 100,
      activity: 'Target practice',
      minutes: 15,
    })
  }
  const achievement = await request(app)
    .post(`/api/skills/${skillId}/achievements`)
    .set(auth)
    .send({ name: 'Bullseye', xp: 200 })
  await request(app)
    .put(`/api/achievements/${achievement.body.id}/obtained`)
    .set(auth)
    .send({ obtained: true, date: '2026-10-06' })
  const page = await request(app)
    .get(
      '/api/v1/automation/xp-entries?skillCode=MRK&from=2026-10-05&to=2026-10-05&limit=1',
    )
    .set(reader)
  expect(page.status).toBe(200)
  expect(page.body).toMatchObject({
    total: 2,
    totalXp: 200,
    totalMinutes: 30,
    latestPracticeDate: '2026-10-05',
    nextOffset: 1,
    timezone: 'America/Denver',
  })
  expect(page.body.entries).toHaveLength(1)
  const next = await request(app)
    .get(
      '/api/v1/automation/xp-entries?skillCode=MRK&from=2026-10-05&to=2026-10-05&limit=1&offset=1',
    )
    .set(reader)
  expect(next.body.nextOffset).toBeNull()
  expect(next.body.entries[0].id).not.toBe(page.body.entries[0].id)
  expect(
    (
      await request(app)
        .get('/api/v1/automation/xp-entries?skillCode=MRK&limit=1')
        .set(reader)
    ).body.latestPracticeDate,
  ).toBe('2026-10-05')
  expect(
    (
      await request(app)
        .get('/api/v1/automation/xp-entries?activity=TARGET')
        .set(reader)
    ).body.total,
  ).toBe(3)
  expect(
    (
      await request(app)
        .get(`/api/v1/automation/xp-entries/${page.body.entries[0].id}`)
        .set(reader)
    ).status,
  ).toBe(200)
  expect(
    (
      await request(app)
        .post('/api/v1/automation/xp-entries')
        .set(reader)
        .send({ skillCode: 'MRK', xp: 10 })
    ).status,
  ).toBe(403)
  expect(
    (
      await request(app)
        .get('/api/v1/automation/xp-entries?from=2026-10-06&to=2026-10-05')
        .set(reader)
    ).status,
  ).toBe(400)
})

it('isolates achievements and history by user, including entry lookup', async () => {
  const first = await setup()
  const second = await setup('another-user')
  const achievement = await request(first.app)
    .post(`/api/skills/${first.skillId}/achievements`)
    .set(first.auth)
    .send({ name: 'Private milestone' })
  expect(
    (
      await request(second.app)
        .put(`/api/achievements/${achievement.body.id}/obtained`)
        .set(second.auth)
        .send({ obtained: true })
    ).status,
  ).toBe(404)
  const entry = await request(first.app)
    .post('/api/xp-entries')
    .set(first.auth)
    .send({ skillId: first.skillId, date: '2026-10-05', xp: 10 })
  expect(
    (
      await request(second.app)
        .get(`/api/v1/automation/xp-entries/${entry.body.id}`)
        .set(second.reader)
    ).status,
  ).toBe(404)
  expect(
    (
      await request(second.app)
        .get(`/api/v1/automation/xp-entries?skillId=${first.skillId}`)
        .set(second.reader)
    ).status,
  ).toBe(404)
})
