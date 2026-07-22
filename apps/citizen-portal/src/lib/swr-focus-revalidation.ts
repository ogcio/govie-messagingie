import type { Middleware, SWRHook } from "swr"

/**
 * Gateway path fragments whose data is volatile enough to justify a refetch
 * every time the tab regains focus. Everything else (profile, org names,
 * folders/tags, attachment metadata, consent, feature flags) is effectively
 * static for a session, so re-hitting it on every focus is wasted work.
 *
 * Keep these specific: `/messaging/api/v1/messages` must NOT also match
 * `/messaging/api/v1/tags`, and attachment metadata (`/upload/...`) is excluded.
 */
const FOCUS_REVALIDATION_PATHS = [
  "/messaging/api/v1/messages",
  "/messaging-public-api/api/v1/citizens/messages",
  "/journey-builder/api/v1/external/user-submissions",
] as const

/**
 * `useGatewayFetch` keys SWR either by the absolute URL (string) or by a
 * `[url, actorType]` tuple. Normalise both shapes to the URL string.
 */
function keyToUrl(key: unknown): string | null {
  if (typeof key === "string") return key
  if (Array.isArray(key) && typeof key[0] === "string") return key[0]
  return null
}

/** True when the SWR key targets a messages or applications endpoint. */
export function shouldRevalidateOnFocus(key: unknown): boolean {
  const url = keyToUrl(key)
  if (!url) return false
  return FOCUS_REVALIDATION_PATHS.some((path) => url.includes(path))
}

/**
 * SWR middleware that flips `revalidateOnFocus` on per request, based on the
 * endpoint. Applied globally via `SWRConfig`, it lets messages/applications
 * stay fresh on tab focus while everything else is fetched once and left
 * alone — avoiding a full refetch storm every time the window regains focus.
 */
export const focusRevalidationByEndpoint: Middleware =
  (useSWRNext: SWRHook) => (key, fetcher, config) =>
    useSWRNext(key, fetcher, {
      ...config,
      revalidateOnFocus: shouldRevalidateOnFocus(key),
    })
