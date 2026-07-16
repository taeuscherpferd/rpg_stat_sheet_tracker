import { AppDatabase } from './database.js'
import { createApp } from './app.js'

process.umask(0o077)

const port = Number(process.env.PORT ?? 3000)
const database = new AppDatabase(process.env.DATABASE_PATH ?? 'rlrpg.db')
const app = createApp(database)

const server = app.listen(port, () => {
  console.log(`RLRPG is running at http://localhost:${port}`)
  if (process.send !== undefined) process.send('ready')
})

const shutdown = (): void => {
  server.close(() => {
    database.close()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
