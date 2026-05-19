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

/** Build the messages path preserving force-consent when session storage says so. */
export function messagesPathWithForceConsent(locale: string): string {
  if (typeof window === "undefined") {
    return `/${locale}/messages`
  }

  const params = new URLSearchParams(window.location.search)
  if (
    params.get(FORCE_CONSENT_PARAM) !== "1" &&
    sessionStorage.getItem(FORCE_CONSENT_SESSION_KEY) === "1"
  ) {
    params.set(FORCE_CONSENT_PARAM, "1")
  }

  const query = params.toString()
  return `/${locale}/messages${query ? `?${query}` : ""}${window.location.hash}`
}

export function clearPersistedForceConsent(): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(FORCE_CONSENT_SESSION_KEY)
}
