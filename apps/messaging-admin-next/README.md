# messaging-admin-next

Next.js **public-servant admin** frontend for the messaging service. Authenticates via the **Secure API Gateway** (`@ogcio/sag-client`) and lets public servants compose and manage messages, templates and providers.

## Auth model

- Client-side auth only, via `@ogcio/sag-client/react` (no server-side auth, no middleware).
- Public-servant sign-in: `signIn()` is called with no connector, so SAG forwards a plain Logto sign-in. The shell writes a `connectorsToShow=ogcio-entraid` cookie so Logto's chooser only shows the EntraID button.

## Getting started

```bash
pnpm install                       # from repo root
cp .env.sample .env.local          # if present; set NEXT_PUBLIC_SAG_URL, NEXT_PUBLIC_SAG_APP_NAME
pnpm --filter messaging-admin-next dev   # or: pnpm dev:admin-next (from root)
```

Runs on [http://localhost:3022](http://localhost:3022) and expects the Secure API Gateway (default `http://localhost:3333`).

## Testing

```bash
pnpm --filter messaging-admin-next test          # vitest (jsdom) + coverage
pnpm --filter messaging-admin-next test:local    # watch mode
pnpm --filter messaging-admin-next test:e2e:local # playwright
```

`test:smoke:e2e` / `test:regression:e2e` run tagged Playwright specs against the hosted dev cluster.
