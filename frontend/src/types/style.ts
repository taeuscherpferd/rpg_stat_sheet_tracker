import type { CSSProperties } from 'react'

export type CustomPropertyStyle = CSSProperties & {
  [customProperty: `--${string}`]: string | number
}
