import { describe, expect, it } from 'vitest'
import { SkillDialogLogic } from './SkillDialog.logic'

describe('SkillDialogLogic', () => {
  it('parses comma-separated tags and removes blank and duplicate values', () => {
    expect(
      SkillDialogLogic.parseTags(' creative, Music, ,creative, practice '),
    ).toEqual(['creative', 'Music', 'practice'])
  })

  it('returns an empty list when no tags are entered', () => {
    expect(SkillDialogLogic.parseTags(' , ')).toEqual([])
  })
})
