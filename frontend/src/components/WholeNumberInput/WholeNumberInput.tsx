import type { ComponentProps } from 'react'

type WholeNumberInputProps = Omit<
  ComponentProps<'input'>,
  | 'type'
  | 'inputMode'
  | 'step'
  | 'value'
  | 'onChange'
  | 'onKeyDown'
  | 'onPaste'
  | 'onBeforeInput'
> & {
  value: string
  onValueChange: (value: string) => void
}

export const WholeNumberInput = ({
  onValueChange,
  ...props
}: WholeNumberInputProps) => (
  <input
    {...props}
    type="number"
    inputMode="numeric"
    step={1}
    onKeyDown={(event) => {
      if (
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        ['e', 'E', '+', '-', '.'].includes(event.key)
      )
        event.preventDefault()
    }}
    onBeforeInput={(event) => {
      const data = (event.nativeEvent as InputEvent).data
      if (data && /[^0-9]/.test(data)) event.preventDefault()
    }}
    onPaste={(event) => {
      if (!/^[0-9]+$/.test(event.clipboardData.getData('text')))
        event.preventDefault()
    }}
    onChange={(event) => {
      const value = event.currentTarget.value
      if (/^[0-9]*$/.test(value)) onValueChange(value)
    }}
  />
)
