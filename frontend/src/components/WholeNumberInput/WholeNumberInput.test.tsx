import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { WholeNumberInput } from '@/components/WholeNumberInput/WholeNumberInput'

const XpField = () => {
  const [value, setValue] = useState('0')
  return (
    <WholeNumberInput
      aria-label="XP"
      value={value}
      onValueChange={setValue}
      min={0}
      max={1000000}
      required
    />
  )
}

afterEach(cleanup)

it('blocks exponent notation, signs, and decimal points while retaining editing keys and shortcuts', () => {
  render(<XpField />)
  const input = screen.getByLabelText('XP')
  for (const key of ['e', 'E', '+', '-', '.']) {
    expect(fireEvent.keyDown(input, { key })).toBe(false)
  }
  for (const key of [
    '0',
    '7',
    'Backspace',
    'Delete',
    'ArrowLeft',
    'ArrowRight',
    'Tab',
  ]) {
    expect(fireEvent.keyDown(input, { key })).toBe(true)
  }
  expect(fireEvent.keyDown(input, { key: 'a', ctrlKey: true })).toBe(true)
  expect(fireEvent.keyDown(input, { key: 'v', metaKey: true })).toBe(true)
})

it('rejects pasted letters and formatted numbers while accepting pasted digits', () => {
  render(<XpField />)
  const input = screen.getByLabelText('XP')
  for (const text of ['e', '1e3', '-10', '+10', '1.5', '1,000', '50 XP']) {
    expect(
      fireEvent.paste(input, { clipboardData: { getData: () => text } }),
    ).toBe(false)
  }
  expect(
    fireEvent.paste(input, { clipboardData: { getData: () => '250' } }),
  ).toBe(true)
  fireEvent.change(input, { target: { value: '1e3' } })
  expect(input).toHaveValue(0)
})

it('still allows clearing zero and entering digits, and retains required and maximum validation', () => {
  render(<XpField />)
  const input = screen.getByLabelText('XP')
  fireEvent.change(input, { target: { value: '' } })
  expect(input).toHaveValue(null)
  expect(input).toBeInvalid()
  fireEvent.change(input, { target: { value: '75' } })
  expect(input).toHaveValue(75)
  expect(input).toBeValid()
  fireEvent.change(input, { target: { value: '1000000' } })
  expect(input).toBeValid()
  fireEvent.change(input, { target: { value: '1000001' } })
  expect(input).toBeInvalid()
})
