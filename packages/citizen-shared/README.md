# @citizen-portal/shared

Cross-cutting helpers consumed by the consolidated `@citizen-portal/app`
(see `apps/citizen-portal/`).

The unified app renders the **messages**, **profile** and **dashboard**
sections from one codebase served under three canonical hostnames; this
package owns the helpers that have to stay identical across those
sections.

## What's in here

- `CitizenSagProvider` — wraps the authenticated tree with
  `SagClientProvider` configured for the shared parent-domain cookie
  scope (`.dev.services.gov.ie`, `.uat.services.gov.ie`,
  `.services.gov.ie`, `.local.test`). A SAG session survives navigation
  between the three citizen hostnames without an extra round-trip.
- `useCrossZoneLink(zone, path)` — host-aware navigation helper. Reads
  the canonical hostname for `messages` / `profile` / `dashboard` from
  the shared env schema and expands `{ href, hostname, … }`. Used by
  shared components (drawer, page header, footer, dashboard tiles) so
  in-app cross-zone navigation always lands on the right canonical host
  (and nginx canonicalisation kicks in if config and reality ever
  drift).
- `useEnv()` / `getEnv()` — typed accessors for the shared client env
  schema (`NEXT_PUBLIC_SAG_URL`, the three hostnames, FARO, Matomo
  analytics, Unleash, …).
- `defineZoneEnv` + `z` + `requiredInProduction` /
  `requiredInDevelopment` — `t3-oss/env-nextjs` re-exports. The unified
  app's `src/env/env.client.ts` declares its schema through these so it
  doesn't have to depend on `zod` / `@t3-oss/env-nextjs` directly.
- Theme / i18n / faro / Matomo initialisation extracted from the
  source apps so the consolidated app stays bit-for-bit aligned with
  the legacy citizen portals during the transition.

## Consumed by

- `@citizen-portal/app` (`apps/citizen-portal/`) — the single
  consolidated citizen-facing Next.js app.

## Testing

```bash
pnpm --filter @citizen-portal/shared test        # vitest (node)
pnpm --filter @citizen-portal/shared test:local  # watch mode
```
