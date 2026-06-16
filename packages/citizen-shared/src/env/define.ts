import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

/**
 * Helper for citizen-portal zones to declare their zone-local env schema
 * without having to add `@t3-oss/env-nextjs` and `zod` as direct
 * dependencies of the zone package.
 *
 * Why this exists: pnpm's strict module resolution only surfaces a package
 * to a consumer's own source when that package is listed in the
 * consumer's `package.json`. The shared package can re-export typed
 * helpers, but the zone cannot `import { z } from "zod"` directly unless
 * it owns that dependency. Re-exporting `createEnv` as `defineZoneEnv`
 * (and re-exporting `z`) lets the zone author its schema fragment
 * without ever importing the underlying libraries directly.
 *
 * `defineZoneEnv` is an alias of `createEnv` so it inherits the full
 * overload-based type inference. Wrapping it in a generic function
 * collapses the precise schema typing back to `unknown`/`never`. If you
 * ever need to add zone-level constraints (e.g. forbid a server schema
 * for static-export zones) do it via a TypeScript declaration overlay,
 * not by introducing a runtime wrapper.
 *
 * Usage in a zone:
 *
 * ```ts
 * import { defineZoneEnv, z } from "@citizen-portal/shared/env"
 *
 * export const env = defineZoneEnv({
 *   client: {
 *     NEXT_PUBLIC_BASE_URL: z.url(),
 *     NEXT_PUBLIC_VERSION: z.string().default("0.0.0"),
 *   },
 *   runtimeEnv: {
 *     NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
 *     NEXT_PUBLIC_VERSION: process.env.NEXT_PUBLIC_VERSION,
 *   },
 * })
 * ```
 *
 * Imported from the subpath `@citizen-portal/shared/env` instead of the
 * package root barrel so Node's transpile-config loader (used by
 * `next.config.ts` at build time) never has to resolve `sag-provider.tsx`
 * just to read the env schema — see `package.json#exports`.
 *
 * The cross-zone shared env (`NEXT_PUBLIC_MESSAGING_URL`,
 * `NEXT_PUBLIC_PROFILE_URL`, `NEXT_PUBLIC_SAG_URL`, etc.) stays accessed
 * via `useEnv()` / `getEnv()` from the package root. Keeping the two
 * surfaces separate lets the shared env evolve without forcing rebuilds
 * of every zone.
 */
export const defineZoneEnv = createEnv

/**
 * `requiredInProduction` — superRefine helper that flags an env var as
 * missing when `NODE_ENV === "production"`. Mirrors the helper used in
 * the legacy messaging-next env schemas; moved here so zones can re-use
 * it without owning `zod` directly.
 */
export const requiredInProduction = (
  value: string | undefined,
  ctx: z.RefinementCtx,
): void => {
  if (process.env.NODE_ENV === "production" && !value) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Missing required environment variable in production",
    })
  }
}

/**
 * `requiredInDevelopment` — symmetric helper for vars that must be
 * present in development mode (rare, but used by some observability
 * configs that need a working endpoint locally).
 */
export const requiredInDevelopment = (
  value: string | undefined,
  ctx: z.RefinementCtx,
): void => {
  if (process.env.NODE_ENV === "development" && !value) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Missing required environment variable in development",
    })
  }
}

export { z }
