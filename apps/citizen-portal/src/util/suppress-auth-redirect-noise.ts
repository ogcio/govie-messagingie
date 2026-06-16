"use client"

/**
 * AB#39103 — suppress the benign "Error checking auth" noise that
 * `@ogcio/sag-client` logs when the full-page sign-in redirect aborts an
 * in-flight `/auth/status` (or `/auth/health`) fetch.
 *
 * On WebKit (every iOS browser uses WebKit) an aborted fetch rejects as
 * `TypeError: Load failed` (Chromium reports "Failed to fetch"); the client's
 * `checkAuth` catches it and calls `console.error("Error checking auth", err)`,
 * which Faro's console instrumentation forwards as a false exception. The user
 * is being redirected on purpose, so the auth check never needed to finish.
 *
 * The filter is only armed for the brief window around a deliberate sign-in
 * navigation, so a genuine gateway outage ("Failed to fetch" with no navigation
 * in progress) is still reported.
 *
 * NOTE: app-local stopgap. Once this app consumes a build of `@ogcio/sag-client`
 * with navigation-aware suppression baked in, this can be removed.
 */

const BENIGN_NETWORK_MESSAGE =
  /load failed|failed to fetch|network ?error|the network connection was lost|aborted/i

// Re-enable normal reporting if the navigation is somehow cancelled.
const RESET_AFTER_MS = 10_000

let navigating = false
let patched = false

function patchConsoleOnce() {
  if (patched || typeof console === "undefined") return
  patched = true
  const original = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    const [first, detail] = args
    if (
      navigating &&
      typeof first === "string" &&
      first.includes("Error checking auth")
    ) {
      const message =
        detail instanceof Error ? detail.message : String(detail ?? "")
      if (BENIGN_NETWORK_MESSAGE.test(message)) {
        return
      }
    }
    original(...args)
  }
}

/**
 * Mark that a deliberate full-page navigation to sign-in is starting so the
 * benign aborted-auth-fetch error is not reported. Call immediately before
 * `signIn()`.
 */
export function suppressAuthRedirectNoise(): void {
  if (typeof window === "undefined") {
    return
  }
  patchConsoleOnce()
  navigating = true
  window.setTimeout(() => {
    navigating = false
  }, RESET_AFTER_MS)
}
