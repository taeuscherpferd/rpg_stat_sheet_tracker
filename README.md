# RLRPG Skill Sheet

RLRPG turns real-world practice into a personal RPG skill ledger. It tracks levels, linked-skill XP, manual activity, Focused Practice sessions, and automation events in a local SQLite database. Focused Practice uses a repeating, configurable Pomodoro countdown with a circular remaining-time indicator and a chime at each completed interval, and remembers each user's last practiced skill in local storage. Skills support tags, optional emojis, and an individually customizable color shared by the header and XP bar. Skill selectors display names before emojis so browser type-to-search works by skill name. The main skill sheet can be filtered by skill name, code, or tag and sorted by name or level.

## Setup

Requirements: Node.js 24+ and pnpm 11+.

```bash
pnpm install
pnpm dev
```

The React client runs at `http://localhost:5173` and proxies API requests to Express at `http://localhost:3000`. Register from the first screen; the browser remembers the resulting 30-day session locally.

For a production build:

```bash
pnpm build
pnpm --filter @rlrpg/backend start
```

Express serves `frontend/dist` in production. Set `PORT` to change the HTTP port and `DATABASE_PATH` to choose the SQLite file location. The backend uses Node 24's built-in `node:sqlite` module, so no native database package or separate SQLite installation is required.

## Progressive Web App

The production frontend is an installable PWA. Its service worker precaches the
application shell, fonts, icons, and visual assets, but deliberately excludes all
`/api` routes. Installation and service workers require a trusted HTTPS origin
outside local development; `localhost` is the only HTTP exception.

After one successful authenticated load, the frontend saves a versioned snapshot
of the user profile, skills, XP history, and Focused Practice settings in
IndexedDB. If the server cannot be reached later, the app opens that snapshot in
read-only mode and shows when it was last synchronized. API key metadata is not
saved offline. Write controls and exports remain unavailable until connectivity
returns, at which point the app refreshes the snapshot automatically. Logging out
or receiving a confirmed authentication rejection clears both the browser session
and the offline snapshot.

To test the service worker locally, create a production build and serve the full
application through Express rather than Vite's development server:

```bash
pnpm build
pnpm --filter @rlrpg/backend start
```

Open `http://localhost:3000`, complete one online sign-in, and then use the
browser's Application and Network developer tools to inspect installation,
service-worker updates, storage, and offline startup.

## Commands

- `pnpm test`: run frontend and backend tests.
- `pnpm lint`: run ESLint and TypeScript checks.
- `pnpm build`: type-check and build all packages.
- `pnpm format:check`: verify Prettier formatting.

## Homelab Deployment

The homelab pipeline deploys a pushed `main` commit over SSH. The target fetches
and builds the commit, then PM2 runs one Express process that serves both the API
and frontend. Releases are immutable; the SQLite database and backups live in a
separate shared directory.

The target container requires:

- Node.js 24 or newer, pnpm 11 or newer, Git, curl, `flock`, and PM2.
- SSH access from the development machine.
- Read access to this GitHub repository. Configure a read-only GitHub deploy key
  on the container when the repository is private.
- A writable application root, `/srv/rlrpg` by default.

Node may be installed with NVM. The remote deployment explicitly loads
`$HOME/.nvm/nvm.sh` and selects Node 24 when Node, pnpm, or PM2 is unavailable
in the non-interactive SSH environment. Because NVM global packages are scoped
to a Node installation, prepare the deployment user with:

```bash
nvm install 24
nvm alias default 24
npm install --global pnpm@11 pm2
```

Copy the deployment configuration and update the SSH host, application path,
port, and repository URL:

```bash
cp .env.deploy.example .env.deploy
pnpm deploy:homelab:check
```

The SSH host can be an alias from `~/.ssh/config`. The deployment configuration
is intentionally ignored by Git. Do not put a private SSH key or other secrets
in that file.

Deploy the current commit with:

```bash
pnpm deploy:homelab
```

Deployment requires a clean working tree and requires local `HEAD` to match the
pushed `origin/main`. Before connecting, it runs the full test, lint, and format
checks. The target builds a new release while the current release remains live,
then briefly stops PM2 to create a verified database snapshot and activate the
release. `/api/health` must report the expected commit within 30 seconds or the
previous release and database are restored automatically.

After the first successful deployment, install the nightly database backup:

```bash
pnpm deploy:homelab:setup
```

Setup installs a systemd timer when systemd and passwordless administrative
access are available. Otherwise it installs a user crontab entry. Backups run at
03:00, use SQLite's online backup API, pass an integrity check before completion,
and are retained for 14 days. Pre-deployment snapshots retain the latest ten;
the latest three application releases are retained.

The default layout on the container is:

```text
/srv/rlrpg/
  current -> releases/<timestamp>-<commit>
  releases/
  repository.git/
  shared/
    rlrpg.db
    backups/deploy/
    backups/scheduled/
```

PM2 is saved after each successful deployment. Run `pm2 startup` once under the
deployment user, following the command PM2 prints, so the saved process list is
restored after a container reboot. Useful diagnostics are:

```bash
pm2 status
pm2 logs rlrpg
curl http://127.0.0.1:3000/api/health
systemctl status rlrpg-backup.timer  # when systemd was selected
crontab -l                           # when cron was selected
```

For a manual data restore, stop `rlrpg`, copy a verified `.db` snapshot over
`shared/rlrpg.db`, remove any adjacent `rlrpg.db-wal` and `rlrpg.db-shm` files,
and start the process again. Keep the process stopped for the entire restore.
Normal failed deployments perform this sequence automatically.

The application listens directly on the configured private container port. Use
the Proxmox or container firewall to restrict it to trusted LAN and VPN subnets.
This deployment does not configure public ingress, DNS, a reverse proxy, or TLS.
Place a TLS-terminating reverse proxy such as Caddy, Traefik, or Nginx in front of
the application before installing the PWA from another device.

## Automation API

Create a named **XP writer** key under Settings → Automation. The key is displayed once and stored only as a hash. Interactive documentation is available at `/api/docs`; the OpenAPI document is `/api/openapi.json`.

Discover a skill:

```bash
curl -H "Authorization: Bearer $RLRPG_API_KEY" \
  "http://localhost:3000/api/v1/automation/skills?q=korean"
```

Award XP safely from a retryable script:

```bash
curl -X POST "http://localhost:3000/api/v1/automation/xp-entries" \
  -H "Authorization: Bearer $RLRPG_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: anki-korean-2026-07-15" \
  -d '{"skillCode":"KOR","xp":50,"activity":"Anki deck completion"}'
```

An assistant should call `listSkills` first, select the stable skill UUID or unique three-character code, and then call `addXp`. Reusing an idempotency key with the same payload returns the original entry; changing the payload returns HTTP 409.

## Data and Exports

SQLite migrations run automatically at startup. XP totals and levels are derived from the award ledger, while linked awards retain the percentages active when the entry was created. Settings provides separate skills and XP-history CSV downloads.

The application is designed for trusted self-hosted use. Keep the database file and API keys private and terminate TLS at a reverse proxy when exposing it beyond localhost.

Account usernames can be changed under Settings → Account. Usernames must be between 3 and 40 characters and remain unique regardless of letter casing.
