import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import type { XpEntryResponse } from '@rlrpg/shared/contracts'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AppLogic } from '@/components/App/App.logic'
import { HistoryView } from '@/components/HistoryView/HistoryView'
import {
  calendarEntry,
  calendarSkills,
} from '@/components/HistoryCalendar/HistoryCalendar.fixtures'

const first = calendarEntry()
const second = calendarEntry({
  id: 'entry-2',
  skillId: 'music',
  skillName: 'Music',
  xp: 25,
  minutes: null,
  notes: null,
  activity: 'Scales',
  awards: [
    {
      skillId: 'music',
      skillName: 'Music',
      amount: 25,
      kind: 'direct',
      percentage: null,
    },
  ],
})
const nextDay = calendarEntry({
  id: 'entry-3',
  date: '2026-11-24',
  xp: 50,
  source: 'focus',
})
const edit = vi.fn<(entry: XpEntryResponse) => void>()
const remove = vi
  .fn<(entry: XpEntryResponse) => Promise<void>>()
  .mockResolvedValue(undefined)
const props = {
  entries: [first, second, nextDay],
  skills: calendarSkills,
  offline: false,
  setEditing: edit,
  removeEntry: remove,
}

beforeEach(() => {
  vi.spyOn(AppLogic, 'today').mockReturnValue('2026-11-23')
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

it('switches views, shows skill emoji chips, and opens full day details with working entry actions', () => {
  render(<HistoryView {...props} />)
  expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Calendar' }))
  const day = screen.getByRole('button', {
    name: /Monday, November 23, 2026: 2 entries, 125 XP/,
  })
  expect(within(day).getByText('Archery')).toBeInTheDocument()
  expect(within(day).getByText('🏹')).toBeInTheDocument()
  expect(within(day).getByText('Music')).toBeInTheDocument()
  expect(within(day).getByText('🎵')).toBeInTheDocument()
  fireEvent.click(day)
  expect(
    screen.getByRole('heading', { name: 'Monday, November 23, 2026' }),
  ).toHaveFocus()
  expect(
    screen.queryByRole('group', { name: 'November 2026 calendar' }),
  ).not.toBeInTheDocument()
  expect(screen.getByText('A good session')).toBeVisible()
  expect(screen.getByText('A good session').closest('details')).toHaveAttribute(
    'open',
  )
  fireEvent.click(screen.getAllByTitle('Edit entry')[0])
  expect(edit).toHaveBeenCalledWith(first)
  fireEvent.click(screen.getAllByTitle('Delete entry')[0])
  expect(remove).toHaveBeenCalledWith(first)
  fireEvent.click(screen.getByRole('button', { name: 'Next day' }))
  expect(
    screen.getByRole('heading', { name: 'Tuesday, November 24, 2026' }),
  ).toBeInTheDocument()
  expect(screen.queryByTitle('Edit entry')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Previous day' }))
  expect(
    screen.getByRole('heading', { name: 'Monday, November 23, 2026' }),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Back to calendar' }))
  expect(
    screen.getByRole('group', { name: 'November 2026 calendar' }),
  ).toBeInTheDocument()
  fireEvent.click(
    screen.getByRole('button', { name: /Wednesday, November 25, 2026:/ }),
  )
  expect(
    screen.getByText('No entries for this day match your filters.'),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'List' }))
  expect(screen.getAllByRole('article')).toHaveLength(3)
})

it('keeps filters and linked-skill XP consistent, including changes while the day view is open', () => {
  const linked = calendarEntry({
    awards: [
      ...first.awards,
      {
        skillId: 'music',
        skillName: 'Music',
        amount: 25,
        kind: 'linked',
        percentage: 25,
      },
    ],
  })
  const { rerender } = render(
    <HistoryView {...props} entries={[linked]} skillId="music" />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Calendar' }))
  const day = screen.getByRole('button', {
    name: /Monday, November 23, 2026: 1 entry, 25 XP/,
  })
  expect(within(day).getByText('Music')).toBeInTheDocument()
  expect(within(day).queryByText('Archery')).not.toBeInTheDocument()
  fireEvent.click(day)
  expect(screen.getByText('+25 XP')).toBeInTheDocument()
  rerender(<HistoryView {...props} entries={[]} skillId="music" />)
  expect(
    screen.getByText('No entries for this day match your filters.'),
  ).toBeInTheDocument()
})

it('navigates months and leap days, returns to today, and keeps offline edit actions disabled', () => {
  render(<HistoryView {...props} offline />)
  fireEvent.click(screen.getByRole('button', { name: 'Calendar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
  expect(
    screen.getByRole('heading', { name: 'October 2026' }),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
  expect(
    screen.getByRole('heading', { name: 'November 2026' }),
  ).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Jump to month'), {
    target: { value: '2024-02' },
  })
  fireEvent.click(
    screen.getByRole('button', { name: /Thursday, February 29, 2024:/ }),
  )
  expect(
    screen.getByRole('heading', { name: 'Thursday, February 29, 2024' }),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Back to calendar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Today' }))
  fireEvent.click(
    screen.getByRole('button', { name: /Monday, November 23, 2026:/ }),
  )
  expect(screen.getAllByTitle('Edit entry')[0]).toBeDisabled()
  expect(screen.getAllByTitle('Delete entry')[0]).toBeDisabled()
})

it('keeps busy calendar cells compact and shows every skill in the full day view', () => {
  const painting = {
    ...calendarSkills[0],
    id: 'painting',
    name: 'Painting',
    emoji: '🎨',
  }
  const third = calendarEntry({
    id: 'entry-painting',
    skillId: 'painting',
    skillName: 'Painting',
    awards: [],
  })
  render(
    <HistoryView
      {...props}
      entries={[first, second, third]}
      skills={[...calendarSkills, painting]}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Calendar' }))
  const day = screen.getByRole('button', {
    name: /Monday, November 23, 2026: 3 entries, 225 XP/,
  })
  expect(within(day).getByText('+1 more')).toBeInTheDocument()
  fireEvent.click(day)
  expect(screen.getByText('Painting', { selector: 'span' })).toBeVisible()
  expect(screen.getByText('🎨')).toBeVisible()
})

it('shows current, best, and daily streak counts using unfiltered marked days', () => {
  const marked = ['2026-11-21', '2026-11-22', '2026-11-23'].map((date) =>
    calendarEntry({ id: date, date, streak: true }),
  )
  const { rerender } = render(
    <HistoryView {...props} entries={[marked[2]]} streakEntries={marked} />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Calendar' }))
  const overview = screen.getByRole('group', { name: 'Calendar streaks' })
  expect(within(overview).getByText('Current streak')).toBeInTheDocument()
  expect(within(overview).getByText('Best streak')).toBeInTheDocument()
  expect(
    within(overview).getAllByRole('img', { name: '3 day streak' }),
  ).toHaveLength(2)
  const day = screen.getByRole('button', {
    name: /Monday, November 23, 2026:.*streak day 3/,
  })
  expect(
    within(day).getByRole('img', { name: '3 day streak' }),
  ).toBeInTheDocument()
  fireEvent.click(day)
  expect(screen.getByRole('img', { name: '3 day streak' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Back to calendar' }))
  rerender(<HistoryView {...props} entries={[]} streakEntries={marked} />)
  expect(
    within(
      screen.getByRole('group', { name: 'Calendar streaks' }),
    ).getAllByRole('img', { name: '3 day streak' }),
  ).toHaveLength(2)
  rerender(
    <HistoryView
      {...props}
      entries={[]}
      streakEntries={marked}
      skillId="music"
    />,
  )
  expect(
    within(
      screen.getByRole('group', { name: 'Calendar streaks' }),
    ).getAllByRole('img', { name: '0 day streak' }),
  ).toHaveLength(2)
})
