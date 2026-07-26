import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const releaseId = 'production-smoke-test'
const temporaryDirectory = mkdtempSync(
  path.join(tmpdir(), 'rlrpg-production-smoke-'),
)

const reservePort = async () =>
  await new Promise((resolve, reject) => {
    const server = createServer()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address === null || typeof address === 'string') {
        server.close()
        reject(new Error('Could not reserve a smoke-test port'))
        return
      }
      server.close((error) => {
        if (error === undefined) resolve(address.port)
        else reject(error)
      })
    })
  })

const wait = async (milliseconds) =>
  await new Promise((resolve) => setTimeout(resolve, milliseconds))

const stopProcess = async (serverProcess) => {
  if (serverProcess.exitCode !== null) return
  serverProcess.kill('SIGTERM')
  await Promise.race([
    new Promise((resolve) => serverProcess.once('exit', resolve)),
    wait(5000),
  ])
  if (serverProcess.exitCode === null) serverProcess.kill('SIGKILL')
}

let serverProcess
let output = ''

try {
  const port = await reservePort()
  serverProcess = spawn(process.execPath, ['backend/dist/server.js'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      DATABASE_PATH: path.join(temporaryDirectory, 'smoke.db'),
      PORT: String(port),
      RELEASE_ID: releaseId,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  serverProcess.stdout.on('data', (chunk) => {
    output += chunk
  })
  serverProcess.stderr.on('data', (chunk) => {
    output += chunk
  })

  const deadline = Date.now() + 10_000
  let healthy = false
  while (Date.now() < deadline && serverProcess.exitCode === null) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`)
      if (response.ok) {
        const body = await response.json()
        healthy = body.status === 'ok' && body.releaseId === releaseId
        if (healthy) break
      }
    } catch {
      await wait(100)
    }
  }

  if (!healthy) {
    throw new Error(`Compiled server failed its health check.\n${output}`)
  }
  console.log('Compiled server passed its production health check.')
} finally {
  if (serverProcess !== undefined) await stopProcess(serverProcess)
  rmSync(temporaryDirectory, { recursive: true, force: true })
}
