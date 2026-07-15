import { BookOpen, Settings as SettingsIcon, Timer } from 'lucide-react'
import styles from './Header.module.scss'

export type AppPage = 'skills' | 'focus' | 'settings'
interface HeaderProps {
  page: AppPage
  username: string
  onNavigate: (page: AppPage) => void
}

export const Header = ({ page, username, onNavigate }: HeaderProps) => (
  <header className={styles.header}>
    <button
      className={styles.brand}
      type="button"
      onClick={() => onNavigate('skills')}
    >
      <span className={styles.mark}>RL</span>
      <span>RLRPG</span>
    </button>
    <nav aria-label="Main navigation">
      <button
        className={page === 'skills' ? styles.active : ''}
        type="button"
        onClick={() => onNavigate('skills')}
      >
        <BookOpen size={18} />
        <span>Skills</span>
      </button>
      <button
        className={page === 'focus' ? styles.active : ''}
        type="button"
        onClick={() => onNavigate('focus')}
      >
        <Timer size={18} />
        <span>Focused Practice</span>
      </button>
      <button
        className={page === 'settings' ? styles.active : ''}
        type="button"
        onClick={() => onNavigate('settings')}
      >
        <SettingsIcon size={18} />
        <span>Settings</span>
      </button>
    </nav>
    <span className={styles.user}>{username}</span>
  </header>
)
