import { skillInputSchema } from '@rlrpg/shared/contracts'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { openApiDocument } from './openapi.js'

describe('OpenAPI skill input', () => {
  const publishedSchema = openApiDocument.components.schemas.SkillInput
  const clientSchema = z.fromJSONSchema(publishedSchema)
  const baseInput = { name: 'Korean', code: 'KOR' }

  it.each([
    { input: { name: ` ${'x'.repeat(80)}\t` }, valid: true },
    { input: { name: '\u0085' }, valid: true },
    { input: { name: '\t \n' }, valid: false },
    { input: { name: 'x'.repeat(81) }, valid: false },
    { input: { tags: [`\u00a0${'x'.repeat(24)}\n`] }, valid: true },
    { input: { tags: ['\u00a0\n'] }, valid: false },
    { input: { tags: ['x'.repeat(25)] }, valid: false },
    { input: { emoji: ` ${'😀'.repeat(8)}\n` }, valid: true },
    { input: { emoji: '😀'.repeat(9) }, valid: false },
    { input: { emoji: ' \n' }, valid: true },
    { input: { emoji: null }, valid: true },
  ])(
    'leaves trimmed length validation for $input to the server',
    ({ input, valid }) => {
      const payload = { ...baseInput, ...input }
      expect(skillInputSchema.safeParse(payload).success).toBe(valid)
      expect(clientSchema.safeParse(payload).success).toBe(true)
    },
  )

  it('documents the trimmed UTF-16 limits without validation keywords', () => {
    const stringField = z.strictObject({
      type: z.literal('string'),
      description: z.string(),
    })
    const fields = z
      .object({
        properties: z.object({
          name: stringField,
          emoji: z.object({
            anyOf: z.tuple([
              stringField,
              z.object({ type: z.literal('null') }),
            ]),
          }),
          tags: z.object({ items: stringField }),
        }),
      })
      .parse(publishedSchema).properties
    expect(fields.name.description).toContain('1–80 UTF-16 code units')
    expect(fields.emoji.anyOf[0].description).toContain(
      '0–16 UTF-16 code units',
    )
    expect(fields.tags.items.description).toContain('1–24 UTF-16 code units')
  })
})

describe('OpenAPI skill creation response', () => {
  it('requires every skill and link field on a successful creation', () => {
    const { paths, components } = openApiDocument
    const response = paths['/skills'].post.responses['201']
    expect(response.content['application/json'].schema.$ref).toBe(
      '#/components/schemas/Skill',
    )
    const skill = components.schemas.Skill
    const link = skill.properties.links.items
    expect(skill.required.toSorted()).toEqual(
      Object.keys(skill.properties).sort(),
    )
    expect(link.required.toSorted()).toEqual(
      Object.keys(link.properties).sort(),
    )
  })
})
