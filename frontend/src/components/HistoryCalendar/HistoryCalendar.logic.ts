import type { SkillResponse, XpEntryResponse } from '@rlrpg/shared/contracts'

export type CalendarDay = { date: string; day: number; inMonth: boolean }
export type CalendarSummary = { entries: XpEntryResponse[]; xp: number }
export type CalendarSkill = { id: string; name: string; emoji: string }
export type CalendarStreaks = {
  current: number
  best: number
  byDate: Record<string, number>
}

export class HistoryCalendarLogic {
  static streaks(
    entries: XpEntryResponse[],
    today: string,
    skillId?: string,
  ): CalendarStreaks {
    const dates = Array.from(
      new Set(
        entries
          .filter(
            (entry) =>
              entry.streak === true &&
              entry.date <= today &&
              (!skillId || entry.skillId === skillId),
          )
          .map((entry) => entry.date),
      ),
    ).sort()
    const byDate: Record<string, number> = {}
    let previous = ''
    let run = 0
    let best = 0
    for (const date of dates) {
      run = previous === HistoryCalendarLogic.shiftDay(date, -1) ? run + 1 : 1
      byDate[date] = run
      best = Math.max(best, run)
      previous = date
    }
    return {
      current:
        byDate[today] ?? byDate[HistoryCalendarLogic.shiftDay(today, -1)] ?? 0,
      best,
      byDate,
    }
  }

  static days(month: string): CalendarDay[] {
    const [year, monthNumber] = month.split('-').map(Number)
    const start = new Date(Date.UTC(year, monthNumber - 1, 1))
    const offset = start.getUTCDay()
    const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
    const cells = Math.ceil((offset + daysInMonth) / 7) * 7
    return Array.from({ length: cells }, (_, index) => {
      const date = new Date(Date.UTC(year, monthNumber - 1, 1 - offset + index))
      const key = date.toISOString().slice(0, 10)
      return {
        date: key,
        day: date.getUTCDate(),
        inMonth: key.startsWith(month),
      }
    })
  }

  static shiftMonth(month: string, offset: number): string {
    const [year, monthNumber] = month.split('-').map(Number)
    return new Date(Date.UTC(year, monthNumber - 1 + offset, 1))
      .toISOString()
      .slice(0, 7)
  }

  static shiftDay(date: string, offset: number): string {
    const next = new Date(`${date}T12:00:00Z`)
    next.setUTCDate(next.getUTCDate() + offset)
    return next.toISOString().slice(0, 10)
  }

  static label(date: string, mode: 'month' | 'day'): string {
    return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'long',
      ...(mode === 'day' ? ({ weekday: 'long', day: 'numeric' } as const) : {}),
    })
  }

  static entryXp(entry: XpEntryResponse, skillId?: string): number {
    return skillId
      ? entry.awards
          .filter((award) => award.skillId === skillId)
          .reduce((sum, award) => sum + award.amount, 0)
      : entry.xp
  }

  static summarize(
    entries: XpEntryResponse[],
    skillId?: string,
  ): Record<string, CalendarSummary> {
    const days: Record<string, CalendarSummary> = {}
    for (const entry of entries) {
      const summary = days[entry.date] ?? { entries: [], xp: 0 }
      summary.entries.push(entry)
      summary.xp += HistoryCalendarLogic.entryXp(entry, skillId)
      days[entry.date] = summary
    }
    return days
  }

  static daySkills(
    entries: XpEntryResponse[],
    skills: SkillResponse[],
    skillId?: string,
  ): CalendarSkill[] {
    const daySkills = new Map<string, CalendarSkill>()
    for (const entry of entries) {
      const id = skillId || entry.skillId
      const skill = skills.find((candidate) => candidate.id === id)
      const name =
        skill?.name ??
        entry.awards.find((award) => award.skillId === id)?.skillName ??
        entry.skillName
      daySkills.set(id, {
        id,
        name,
        emoji: skill?.emoji || skill?.code[0] || name[0],
      })
    }
    return Array.from(daySkills.values())
  }
}
