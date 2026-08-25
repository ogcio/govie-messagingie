# Scripts

Developer-experience scripts for the monorepo. Run them from the repo root via the `pnpm` wrappers in the root `package.json`.

```
scripts/
├── dev/                  # setup.mjs, health-check.mjs, pipeline-local.mjs, azure-pipeline-local.mjs, ...
├── db/                   # reset.mjs
├── init-env.mjs          # .env init/update/sync
└── smart-workspace-update.ts
```

## Environment setup

| Command | What it does |
|---|---|
| `pnpm dev:setup` | Validate prereqs (Node >=24, pnpm, Docker), init `.env`s, install deps, start/detect Postgres, create + migrate DB |
| `pnpm dev:health` | Check DB, API `/health`, frontends, MailDev, ports |
| `pnpm dev:reset` | `clean` then re-run `dev:setup` |

## Env files

| Command | What it does |
|---|---|
| `pnpm env:init` | Create missing `.env` from `.env.sample` (skips existing) |
| `pnpm env:update` / `pnpm env:sync` | Add missing keys, drop obsolete ones, preserve values |
| `pnpm env:dry-run` | Preview changes without writing |

## Database

| Command | What it does |
|---|---|
| `pnpm db:up` | Start Docker services (postgres, redis, maildev, clamav, S3) |
| `pnpm db:prepare` | compose up + create + migrate + sync event summary |
| `pnpm db:reset` | Drop/create/migrate (add `--force` to skip prompt, `--seed` to seed) |
| `pnpm db:seed` / `pnpm db:reset:seed` | Seed test providers + templates (users/messages are not seeded — created via Logto/auth) |

## Pipeline (local CI parity)

| Command | What it does |
|---|---|
| `pnpm pipeline:local` | Run pipeline steps locally (`--skip-tests`, `--skip-docker`, `--continue`) |
| `pnpm azure:local` | Azure pipeline helper (`--analyze`, `--setup-agent`, `--github`, `--manual`) |
| `pnpm deps:smart-update` | Smart workspace dependency update (see `SMART-UPDATE-README.md`) |

## Common config env vars

Read from app `.env` files (root `.env` for shared values), with sensible defaults:

- DB: `POSTGRES_HOST`, `POSTGRES_PORT` (5432), `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB_NAME`
- Ports: messaging-api 8002, profile-api 8003, scheduler-api 8005, upload-api 8008; MailDev UI 1080

## Troubleshooting

```bash
pnpm dev:health            # what's up / down
pnpm db:up                 # (re)start docker services
docker ps | grep postgres  # is the DB running?
lsof -i :8002              # who holds a port
pnpm dev:reset             # nuke + re-setup
```
