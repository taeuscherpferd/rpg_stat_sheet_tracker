import path from 'node:path'
import { DatabaseBackup } from './DatabaseBackup.js'

const usage = (): never => {
  throw new Error(
    'Usage: backup create <database> <destination> | backup scheduled <database> <directory> [retention-days]',
  )
}

const requiredArgument = (value: string | undefined): string => {
  if (value === undefined) {
    return usage()
  }
  return value
}

const main = async (): Promise<void> => {
  const argumentsList = process.argv.slice(2)
  const command = requiredArgument(argumentsList[0])
  const databasePath = requiredArgument(argumentsList[1])
  const outputPath = requiredArgument(argumentsList[2])
  const retentionValue = argumentsList[3]

  if (command === 'create') {
    await DatabaseBackup.create(databasePath, outputPath)
    console.log(outputPath)
    return
  }

  if (command === 'scheduled') {
    const retentionDays = Number(retentionValue ?? 14)
    if (!Number.isInteger(retentionDays) || retentionDays < 1) usage()
    const filename = `rlrpg-${DatabaseBackup.timestamp()}.db`
    const backupPath = path.join(outputPath, filename)
    await DatabaseBackup.create(databasePath, backupPath)
    DatabaseBackup.prune(outputPath, 'rlrpg-', retentionDays)
    console.log(backupPath)
    return
  }

  usage()
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
