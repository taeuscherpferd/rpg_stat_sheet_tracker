import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { CharacterPage } from '@/components/CharacterPage/CharacterPage'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

it('starts with Adventurer selected and creates a character without a class prompt', () => {
  const { unmount } = render(<CharacterPage userId="default-class-user" />)
  expect(screen.getByLabelText('Class')).toHaveValue('Adventurer')
  expect(screen.getByLabelText('Character title')).toHaveValue('')
  expect(screen.getByRole('option', { name: 'No title' })).toHaveProperty(
    'selected',
    true,
  )
  expect(
    screen.queryByRole('option', { name: 'Choose class' }),
  ).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Ash' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Create character' }))
  unmount()
  render(<CharacterPage userId="default-class-user" />)
  expect(
    screen.getByRole('img', { name: /Woman Adventurer idle/ }),
  ).toBeInTheDocument()
})

it('creates a character with a custom description and restores it after remounting', () => {
  const { unmount } = render(<CharacterPage userId="new-user" />)
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Willow' },
  })
  fireEvent.change(screen.getByLabelText('Class'), {
    target: { value: 'Ranger' },
  })
  const description =
    'A ranger from the northern woods.\nAlways ready to explore.'
  fireEvent.change(screen.getByLabelText('Description'), {
    target: { value: description },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Create character' }))
  expect(
    screen.getByText(/A ranger from the northern woods/),
  ).toHaveTextContent('Always ready to explore.')

  unmount()
  render(<CharacterPage userId="new-user" />)
  fireEvent.click(screen.getByRole('button', { name: 'Change character' }))
  expect(screen.getByLabelText('Description')).toHaveValue(description)
})

it('preserves old profiles, saves description edits, and discards canceled edits', () => {
  localStorage.setItem(
    'rlrpg.character.returning-user',
    JSON.stringify({
      appearanceId: 'rowan',
      name: 'Oak',
      gender: 'Man',
      characterClass: 'Mage',
    }),
  )
  render(<CharacterPage userId="returning-user" />)
  fireEvent.click(screen.getByRole('button', { name: 'Change character' }))
  expect(screen.getByLabelText('Class')).toHaveValue('Mage')
  expect(screen.getByLabelText('Description')).toHaveValue(
    'A quick-eyed companion who always knows the way home.',
  )
  fireEvent.change(screen.getByLabelText('Description'), {
    target: { value: 'A keeper of ancient magic.' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(screen.getByText('A keeper of ancient magic.')).toBeInTheDocument()
  expect(localStorage.getItem('rlrpg.character.returning-user')).toContain(
    'A keeper of ancient magic.',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Change character' }))
  fireEvent.change(screen.getByLabelText('Description'), {
    target: { value: 'Unsaved draft' },
  })
  fireEvent.click(
    screen.getByRole('button', { name: 'Keep current character' }),
  )
  expect(screen.queryByText('Unsaved draft')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Change character' }))
  expect(screen.getByLabelText('Description')).toHaveValue(
    'A keeper of ancient magic.',
  )
})

it('allows clearing a description and keeps other accounts unchanged', () => {
  localStorage.setItem('rlrpg.character.first-user', 'mira')
  localStorage.setItem('rlrpg.character.other-user', 'rowan')
  const { unmount } = render(<CharacterPage userId="first-user" />)
  fireEvent.click(screen.getByRole('button', { name: 'Change character' }))
  expect(screen.getByLabelText('Description')).toHaveValue(
    'A warm smile, a steady stride, and a well-loved travel cloak.',
  )
  fireEvent.change(screen.getByLabelText('Description'), {
    target: { value: '' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  unmount()
  render(<CharacterPage userId="first-user" />)
  fireEvent.click(screen.getByRole('button', { name: 'Change character' }))
  expect(screen.getByLabelText('Description')).toHaveValue('')
  expect(localStorage.getItem('rlrpg.character.other-user')).toBe('rowan')
})
