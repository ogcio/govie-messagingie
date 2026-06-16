/** Must match `@ogcio/consent` `FORCE_CONSENT_PARAM`. */
const FORCE_CONSENT_PARAM = "force-consent"
export const FORCE_CONSENT_SESSION_KEY = "messaging-next:force-consent"

/**
 * Remember a force-consent deep link and restore it on the current URL when
 * an auth round-trip lands back on /en/messages without the query param.
 */
export function persistForceConsentFromUrl(): void {
  if (typeof window === "undefined") return

  const params = new URLSearchParams(window.location.search)
  if (params.get(FORCE_CONSENT_PARAM) === "1") {
    sessionStorage.setItem(FORCE_CONSENT_SESSION_KEY, "1")
    return
  }

  if (
    sessionStorage.getItem(FORCE_CONSENT_SESSION_KEY) === "1" &&
    params.get(FORCE_CONSENT_PARAM) !== "1"
  ) {
    params.set(FORCE_CONSENT_PARAM, "1")
    const query = params.toString()
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`
    window.history.replaceState(history.state, "", nextUrl)
  }
}

/**
 * Append the force-consent query (and the rest of the current URL's
 * search/hash) to an in-zone landing path. Used by the zone-aware
 * landing redirects to preserve a `?force-consent=1` deep link across
 * the locale-root → zone-root hop.
 *
 * Server-side or with no force-consent context, returns the path
 * untouched.
 */
export function withForceConsent(path: string): string {
  if (typeof window === "undefined") return path

  const params = new URLSearchParams(window.location.search)
  if (
    params.get(FORCE_CONSENT_PARAM) !== "1" &&
    sessionStorage.getItem(FORCE_CONSENT_SESSION_KEY) === "1"
  ) {
    params.set(FORCE_CONSENT_PARAM, "1")
  }

  const query = params.toString()
  return `${path}${query ? `?${query}` : ""}${window.location.hash}`
}

export function clearPersistedForceConsent(): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(FORCE_CONSENT_SESSION_KEY)
}
