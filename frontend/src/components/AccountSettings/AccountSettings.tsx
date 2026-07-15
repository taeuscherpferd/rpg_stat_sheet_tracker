import { type FormEvent, useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/hooks'
import { updateProfile } from '@/store'
import styles from './AccountSettings.module.scss'

export const AccountSettings = () => {
  const dispatch = useAppDispatch()
  const user = useAppSelector((state) => state.app.user)
  const loading = useAppSelector((state) => state.app.loading)
  const [username, setUsername] = useState(user?.username ?? '')
  const [saved, setSaved] = useState(false)

  const saveAccount = async (event: FormEvent) => {
    event.preventDefault()
    setSaved(false)
    try {
      const updatedUser = await dispatch(updateProfile({ username })).unwrap()
      setUsername(updatedUser.username)
      setSaved(true)
    } catch {
      setSaved(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={(event) => void saveAccount(event)}>
      <h2>Account</h2>
      <p>Update the name used to sign in and identify your ledger.</p>
      <label>
        Username
        <input
          required
          minLength={3}
          maxLength={40}
          autoComplete="username"
          value={username}
          onChange={(event) => {
            setUsername(event.target.value)
            setSaved(false)
          }}
        />
      </label>
      <div className={styles.actions}>
        <button
          className={styles.primary}
          disabled={loading || username.trim() === user?.username}
          type="submit"
        >
          Save username
        </button>
        {saved && <span role="status">Username saved.</span>}
      </div>
    </form>
  )
}
