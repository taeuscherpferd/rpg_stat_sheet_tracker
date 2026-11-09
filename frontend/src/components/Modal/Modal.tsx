import type { CSSProperties, ReactNode } from 'react'
import { X } from 'lucide-react'
import styles from './Modal.module.scss'

interface ModalProps {
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
  style?: CSSProperties
}

export const Modal = ({
  title,
  children,
  onClose,
  wide = false,
  style,
}: ModalProps) => (
  <div
    className={styles.backdrop}
    role="presentation"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}
  >
    <section
      className={`${styles.modal} ${wide ? styles.wide : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      style={style}
    >
      <header>
        <h2 id="modal-title">{title}</h2>
        <button type="button" title="Close" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      {children}
    </section>
  </div>
)
