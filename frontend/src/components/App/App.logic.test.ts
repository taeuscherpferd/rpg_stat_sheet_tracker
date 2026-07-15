import { describe, expect, it, vi } from 'vitest'
import { AppLogic } from './App.logic'

describe('AppLogic', () => {
  it('generates mnemonic three-character codes', () => {
    expect(AppLogic.suggestCode('Guitar')).toBe('GTR')
    expect(AppLogic.suggestCode('Korean Language')).toBe('KLA')
    expect(AppLogic.suggestCode('Read Write Speak')).toBe('RWS')
    expect(AppLogic.suggestCode('')).toBe('XXX')
  })
  it('returns the local calendar date', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-07-15T12:00:00Z'))
    expect(AppLogic.today()).toMatch(/^2026-07-15$/)
    vi.useRealTimers()
  })
})
