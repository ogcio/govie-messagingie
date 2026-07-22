import type { SagClient } from "@ogcio/sag-client"

/**
 * How long a resolved auth/health check is reused before the gateway is hit
 * again (AB#40680).
 *
 * `useAuth()` in `@ogcio/sag-client` is not shared: every consumer — the
 * onboarding guard, the stale-claims gate, the authenticated shell, the
 * feature-flags bridge, and each data component — mounts its own copy and
 * independently calls `client.checkAuth()` + `client.checkHealth()`. On the
 * messages page that was ~5 duplicate round-trips of each, resolved as a
 * sequential gate-by-gate waterfall.
 *
 * Coalescing at the client makes the first check do the real request while
 * every near-simultaneous consumer reuses it, collapsing the whole gate chain
 * to a single `/auth/status` + `/auth/health` per load. The window only needs
 * to span the initial mount burst; a session change always goes through a full
 * navigation (`invalidateSession()` → redirect/reload) which constructs a
 * fresh client, so there is no stale-after-mutation risk.
 */
export const AUTH_CHECK_COALESCE_MS = 10_000

/**
 * Wrap a zero-arg async function so that concurrent calls share one in-flight
 * promise and, once resolved, the result is reused for `ttlMs`. Rejections are
 * never cached — the next call retries.
 *
 * `now` is injectable for tests.
 */
export function coalesce<T>(
  fn: () => Promise<T>,
  ttlMs: number,
  now: () => number = Date.now,
): () => Promise<T> {
  let inFlight: Promise<T> | null = null
  let cached: { result: T } | null = null
  let resolvedAt = 0

  return () => {
    if (inFlight) {
      return inFlight
    }
    if (cached && now() - resolvedAt < ttlMs) {
      return Promise.resolve(cached.result)
    }
    inFlight = fn().then(
      (result) => {
        cached = { result }
        resolvedAt = now()
        inFlight = null
        return result
      },
      (error) => {
        inFlight = null
        throw error
      },
    )
    return inFlight
  }
}

type CoalesceableClient = SagClient & { __authChecksCoalesced?: boolean }

/**
 * Idempotently replace a `SagClient` instance's `checkAuth` / `checkHealth`
 * with coalescing wrappers. Safe to call on every render — the flag guards
 * against double-wrapping.
 */
export function coalesceAuthChecks(
  client: SagClient,
  ttlMs: number = AUTH_CHECK_COALESCE_MS,
): void {
  const coalesceable = client as CoalesceableClient
  if (coalesceable.__authChecksCoalesced) {
    return
  }
  coalesceable.__authChecksCoalesced = true
  coalesceable.checkAuth = coalesce(client.checkAuth.bind(client), ttlMs)
  coalesceable.checkHealth = coalesce(client.checkHealth.bind(client), ttlMs)
}
