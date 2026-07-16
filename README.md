# RLRPG Skill Sheet

RLRPG turns real-world practice into a personal RPG skill ledger. It tracks levels, linked-skill XP, manual activity, Focused Practice sessions, and automation events in a local SQLite database. Focused Practice uses a repeating, configurable Pomodoro countdown with a circular remaining-time indicator and a chime at each completed interval. Skills support tags and an individually customizable color shared by the header and XP bar. The main skill sheet can be filtered by skill name, code, or tag and sorted by name or level.

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

## Commands

- `pnpm test`: run frontend and backend tests.
- `pnpm lint`: run ESLint and TypeScript checks.
- `pnpm build`: type-check and build all packages.
- `pnpm format:check`: verify Prettier formatting.

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
