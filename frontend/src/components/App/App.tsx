import { useEffect, useState } from 'react'
import { AlertCircle, X } from 'lucide-react'
import { AuthScreen } from '@/components/AuthScreen/AuthScreen'
import { FocusedPractice } from '@/components/FocusedPractice/FocusedPractice'
import { Header, type AppPage } from '@/components/Header/Header'
import { Settings } from '@/components/Settings/Settings'
import { SkillSheet } from '@/components/SkillSheet/SkillSheet'
import { useAppDispatch, useAppSelector } from '@/hooks'
import { clearError, initialize, refreshData } from '@/store'
import styles from './App.module.scss'

export const App = () => {
  const dispatch = useAppDispatch()
  const { user, initialized, error } = useAppSelector((state) => state.app)
  const [page, setPage] = useState<AppPage>('skills')

  useEffect(() => {
    void dispatch(initialize())
  }, [dispatch])
  useEffect(() => {
    if (user !== null) void dispatch(refreshData())
  }, [dispatch, user])

  if (!initialized)
    return <main className={styles.loading}>Opening the ledger...</main>
  if (user === null) return <AuthScreen />

  return (
    <div className={styles.shell}>
      <Header page={page} username={user.username} onNavigate={setPage} />
      {error !== null && (
        <div className={styles.error} role="alert">
          <AlertCircle size={18} /> <span>{error}</span>
          <button
            type="button"
            title="Dismiss"
            onClick={() => dispatch(clearError())}
          >
            <X size={18} />
          </button>
        </div>
      )}
      <main
        className={`${styles.main} ${page === 'settings' ? styles.settingsMain : ''}`}
      >
        {page === 'skills' && <SkillSheet />}
        {page === 'focus' && <FocusedPractice />}
        {page === 'settings' && <Settings />}
      </main>
    </div>
  )
}
