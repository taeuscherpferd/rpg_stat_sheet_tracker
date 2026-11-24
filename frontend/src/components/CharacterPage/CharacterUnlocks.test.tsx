import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { CharacterPage } from '@/components/CharacterPage/CharacterPage'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

it('shows XP progress and unlocks background choices as XP increases', () => {
  const { rerender, container } = render(
    <CharacterPage userId="xp-user" totalXp={0} />,
  )
  expect(screen.getByRole('button', { name: 'Greenwood Forest' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Mountain Pass' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Mountain Pass' }))
  expect(
    screen.getByRole('button', { name: 'Greenwood Forest' }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(
    screen.getByRole('progressbar', { name: 'Starlit Sky unlock progress' }),
  ).toHaveAttribute('value', '0')
  rerender(<CharacterPage userId="xp-user" totalXp={4999} />)
  expect(screen.getByRole('button', { name: 'Mountain Pass' })).toBeDisabled()
  rerender(<CharacterPage userId="xp-user" totalXp={5000} />)
  expect(screen.getByRole('button', { name: 'Mountain Pass' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Moonlit Lake' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Mountain Pass' }))
  expect(screen.getByRole('status')).toHaveTextContent('Mountain Pass')
  rerender(<CharacterPage userId="xp-user" totalXp={99999} />)
  expect(screen.getByRole('button', { name: 'Starlit Sky' })).toBeDisabled()
  rerender(<CharacterPage userId="xp-user" totalXp={100000} />)
  expect(screen.getByRole('button', { name: 'Starlit Sky' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Starlit Sky' }))
  expect(screen.getByRole('status')).toHaveTextContent('Starlit Sky')
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Nova' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create character' }))
  expect(
    screen.queryByRole('group', { name: 'Background' }),
  ).not.toBeInTheDocument()
  expect(
    container.querySelector('[data-background="stars"]'),
  ).toBeInTheDocument()
  rerender(<CharacterPage userId="xp-user" totalXp={99999} />)
  expect(
    container.querySelector('[data-background="stars"]'),
  ).not.toBeInTheDocument()
  expect(
    container.querySelector('[data-background="forest"]'),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Change character' }))
  expect(screen.getByRole('button', { name: 'Starlit Sky' })).toBeDisabled()
  expect(
    screen.getByRole('button', { name: 'Greenwood Forest' }),
  ).toHaveAttribute('aria-pressed', 'true')
})
