import { describe, expect, it } from 'vitest'
import { HistoryCalendarLogic } from '@/components/HistoryCalendar/HistoryCalendar.logic'
import {
  calendarEntry,
  calendarSkills,
} from '@/components/HistoryCalendar/HistoryCalendar.fixtures'

describe('calendar date calculations', () => {
  it('builds full Sunday-to-Saturday weeks, including leap days and adjoining months', () => {
    const leap = HistoryCalendarLogic.days('2024-02')
    expect(leap[0]).toEqual({ date: '2024-01-28', day: 28, inMonth: false })
    expect(leap.at(-1)).toEqual({ date: '2024-03-02', day: 2, inMonth: false })
    expect(leap.filter((day) => day.inMonth)).toHaveLength(29)
    expect(HistoryCalendarLogic.days('2026-02')).toHaveLength(28)
    expect(HistoryCalendarLogic.days('2026-08')).toHaveLength(42)
    expect(
      HistoryCalendarLogic.days('2026-03').filter((day) => day.inMonth),
    ).toHaveLength(31)
  })

  it('moves between months and dates across year, leap-year, and daylight-saving boundaries', () => {
    expect(HistoryCalendarLogic.shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(HistoryCalendarLogic.shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(HistoryCalendarLogic.shiftDay('2024-02-28', 1)).toBe('2024-02-29')
    expect(HistoryCalendarLogic.shiftDay('2026-01-01', -1)).toBe('2025-12-31')
    expect(HistoryCalendarLogic.shiftDay('2026-03-08', 1)).toBe('2026-03-09')
  })

  it('labels dates without a timezone shifting the recorded day', () => {
    expect(HistoryCalendarLogic.label('2026-11-01', 'month')).toBe(
      'November 2026',
    )
    expect(HistoryCalendarLogic.label('2026-11-23', 'day')).toBe(
      'Monday, November 23, 2026',
    )
  })
})

describe('calendar history summaries', () => {
  const linked = calendarEntry({
    awards: [
      ...calendarEntry().awards,
      {
        skillId: 'music',
        skillName: 'Music',
        amount: 25,
        kind: 'linked',
        percentage: 25,
      },
    ],
  })

  it('groups entries by their recorded dates and counts linked XP correctly for skill filters', () => {
    const next = calendarEntry({ id: 'entry-2', date: '2026-11-24', xp: 50 })
    expect(HistoryCalendarLogic.summarize([])).toEqual({})
    const all = HistoryCalendarLogic.summarize([linked, linked, next])
    expect(all['2026-11-23'].xp).toBe(200)
    expect(all['2026-11-23'].entries).toHaveLength(2)
    expect(all['2026-11-24'].xp).toBe(50)
    expect(
      HistoryCalendarLogic.summarize([linked], 'music')['2026-11-23'].xp,
    ).toBe(25)
    expect(HistoryCalendarLogic.entryXp(linked, 'missing')).toBe(0)
  })

  it('deduplicates daily skills and uses the selected skill name and emoji', () => {
    expect(
      HistoryCalendarLogic.daySkills([linked, linked], calendarSkills),
    ).toEqual([{ id: 'archery', name: 'Archery', emoji: '🏹' }])
    expect(
      HistoryCalendarLogic.daySkills([linked], calendarSkills, 'music'),
    ).toEqual([{ id: 'music', name: 'Music', emoji: '🎵' }])
    expect(HistoryCalendarLogic.daySkills([linked], [], 'music')).toEqual([
      { id: 'music', name: 'Music', emoji: 'M' },
    ])
    expect(
      HistoryCalendarLogic.daySkills([calendarEntry({ awards: [] })], []),
    ).toEqual([{ id: 'archery', name: 'Archery', emoji: 'A' }])
    expect(
      HistoryCalendarLogic.daySkills(
        [linked],
        [{ ...calendarSkills[0], emoji: null, code: 'BOW' }],
      )[0].emoji,
    ).toBe('B')
    expect(HistoryCalendarLogic.daySkills([], calendarSkills)).toEqual([])
  })
})

describe('calendar streaks', () => {
  it('counts unique marked days, resets after gaps, and ignores future and unmarked entries', () => {
    const entries = [
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-21',
      '2026-11-22',
      '2026-11-23',
    ].map((date) => calendarEntry({ date, streak: true }))
    entries.push(
      entries[6],
      calendarEntry({ date: '2026-11-20', streak: false }),
      calendarEntry({ date: '2026-11-24', streak: true }),
    )
    const streaks = HistoryCalendarLogic.streaks(entries, '2026-11-23')
    expect(streaks.current).toBe(3)
    expect(streaks.best).toBe(4)
    expect(streaks.byDate['2026-11-23']).toBe(3)
    expect(streaks.byDate['2026-11-02']).toBe(4)
    expect(Object.keys(streaks.byDate)).toHaveLength(7)
    expect(streaks.byDate['2026-11-24']).toBeUndefined()
  })

  it('keeps yesterday streaks active, expires them after a missed day, and handles empty history', () => {
    const entries = ['2026-11-21', '2026-11-22'].map((date) =>
      calendarEntry({ date, streak: true }),
    )
    expect(HistoryCalendarLogic.streaks(entries, '2026-11-23').current).toBe(2)
    expect(HistoryCalendarLogic.streaks(entries, '2026-11-24').current).toBe(0)
    expect(
      HistoryCalendarLogic.streaks(
        [...entries, calendarEntry({ date: '2026-11-24', streak: true })],
        '2026-11-24',
      ).current,
    ).toBe(1)
    expect(HistoryCalendarLogic.streaks([], '2026-11-23')).toEqual({
      current: 0,
      best: 0,
      byDate: {},
    })
  })

  it('uses each marked entry primary skill rather than its shared XP awards for skill streaks', () => {
    const entries = [
      calendarEntry({
        date: '2026-11-23',
        streak: true,
        awards: [
          {
            skillId: 'music',
            skillName: 'Music',
            kind: 'linked',
            amount: 25,
            percentage: 25,
          },
        ],
      }),
      calendarEntry({ date: '2026-11-22', skillId: 'music', streak: true }),
    ]
    expect(HistoryCalendarLogic.streaks(entries, '2026-11-23').current).toBe(2)
    expect(
      HistoryCalendarLogic.streaks(entries, '2026-11-23', 'archery').current,
    ).toBe(1)
    expect(
      HistoryCalendarLogic.streaks(entries, '2026-11-23', 'music'),
    ).toEqual({ current: 1, best: 1, byDate: { '2026-11-22': 1 } })
  })
})
