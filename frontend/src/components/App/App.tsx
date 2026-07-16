import { useEffect, useState } from 'react'
import { AlertCircle, CloudOff, X } from 'lucide-react'
import { AuthScreen } from '@/components/AuthScreen/AuthScreen'
import { FocusedPractice } from '@/components/FocusedPractice/FocusedPractice'
import { Header, type AppPage } from '@/components/Header/Header'
import { Settings } from '@/components/Settings/Settings'
import { SkillSheet } from '@/components/SkillSheet/SkillSheet'
import { useAppDispatch, useAppSelector } from '@/hooks'
import { clearError, connectionChanged, initialize, refreshData } from '@/store'
import styles from './App.module.scss'

export const App = () => {
  const dispatch = useAppDispatch()
  const { user, initialized, hasLoadedData, connection, lastSyncedAt, error } =
    useAppSelector((state) => state.app)
  const [page, setPage] = useState<AppPage>('skills')

  useEffect(() => {
    void dispatch(initialize())
  }, [dispatch])
  useEffect(() => {
    if (user !== null && !hasLoadedData && connection === 'online') {
      void dispatch(refreshData())
    }
  }, [connection, dispatch, hasLoadedData, user])
  useEffect(() => {
    const wentOffline = () => dispatch(connectionChanged(false))
    const cameOnline = () => {
      dispatch(connectionChanged(true))
      if (user !== null) void dispatch(refreshData())
    }
    window.addEventListener('offline', wentOffline)
    window.addEventListener('online', cameOnline)
    return () => {
      window.removeEventListener('offline', wentOffline)
      window.removeEventListener('online', cameOnline)
    }
  }, [dispatch, user])

  if (!initialized)
    return <main className={styles.loading}>Opening the ledger...</main>
  if (user === null) return <AuthScreen />

  return (
    <div className={styles.shell}>
      <Header page={page} username={user.username} onNavigate={setPage} />
      {connection === 'offline' && (
        <div className={styles.offline} role="status">
          <CloudOff size={18} />
          <span>
            Offline: showing your saved ledger
            {lastSyncedAt === null ? (
              '.'
            ) : (
              <>
                {' '}
                from{' '}
                <time dateTime={lastSyncedAt}>
                  {new Date(lastSyncedAt).toLocaleString()}
                </time>
                .
              </>
            )}{' '}
            Changes are unavailable until you reconnect.
          </span>
        </div>
      )}
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
