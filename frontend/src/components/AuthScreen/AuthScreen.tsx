import { type FormEvent, useState } from 'react'
import { Compass } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/hooks'
import { login, register } from '@/store'
import styles from './AuthScreen.module.scss'

export const AuthScreen = () => {
  const dispatch = useAppDispatch()
  const loading = useAppSelector((state) => state.app.loading)
  const error = useAppSelector((state) => state.app.error)
  const [creating, setCreating] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void dispatch(
      creating
        ? register({ username, password })
        : login({ username, password }),
    )
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <Compass className={styles.compass} size={44} strokeWidth={1.4} />
        <p className={styles.eyebrow}>RLRPG</p>
        <h1>Begin your record</h1>
        <p className={styles.intro}>
          A ledger for the skills earned beyond the screen.
        </p>
        <div className={styles.segmented}>
          <button
            type="button"
            className={!creating ? styles.selected : ''}
            onClick={() => setCreating(false)}
          >
            Sign in
          </button>
          <button
            type="button"
            className={creating ? styles.selected : ''}
            onClick={() => setCreating(true)}
          >
            Create account
          </button>
        </div>
        <form onSubmit={submit}>
          <label>
            Username
            <input
              required
              minLength={3}
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              required
              minLength={8}
              type="password"
              autoComplete={creating ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error !== null && <p className={styles.error}>{error}</p>}
          <button className={styles.submit} disabled={loading} type="submit">
            {creating ? 'Create ledger' : 'Open ledger'}
          </button>
        </form>
      </section>
    </main>
  )
}
