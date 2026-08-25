# upload-api

Fastify API for file uploads. Stores objects in S3 and virus-scans them with ClamAV before they are made available.

## Getting started

```bash
pnpm install                    # from repo root
cp .env.sample .env             # set POSTGRES_*, S3_ENDPOINT (default http://localhost:4566), etc.
pnpm db:up                      # starts postgres, S3 (ministack :4566) and clamav via docker
pnpm --filter upload-api migrate
pnpm --filter upload-api dev    # or: pnpm dev:api:upload (from root)
```

Runs on port `8008`. Depends on Postgres, S3 (ministack/localstack on `:4566`) and ClamAV — all provided by the root `docker-compose.yaml`. The S3 plugin does a `HeadBucket` at startup, so S3 must be reachable or the server won't boot.

Swagger UI at `GET /docs`.

## Testing

```bash
pnpm --filter upload-api test                     # vitest + coverage
pnpm --filter upload-api test:local               # watch mode
pnpm --filter upload-api test:integration:clamav  # ClamAV integration (needs clamav container)
pnpm --filter upload-api test:e2e                  # bruno e2e (local env)
pnpm --filter upload-api test:k6                   # k6 load tests (see k6/README.md)
```

## Health endpoints

- `GET /health` — liveness; no external deps, returns package/version.
- `GET /health/ready` — readiness; checks Postgres, returns `{ "db": true }`.
- `GET /health/startup` — checks system, Postgres and S3; returns `{ "system": true, "db": true, "s3": true }`, or `500` with the failed dependency.
