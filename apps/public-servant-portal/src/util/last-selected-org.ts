/**
 * Durable, per-user memory of the last organization the admin user selected.
 *
 * The Secure API Gateway tracks the active org in the `sag_selected_org`
 * signed cookie, but that cookie is cleared on sign-out — so on the next login
 * the app has no record of the user's choice and defaults to the first org in
 * their claims, silently reverting the selection (AB#28623).
 *
 * We mirror the selection in `localStorage`, which survives the logout/login
 * round-trip (sign-out only clears cookies, never local storage), and restore
 * it at login when the user still has access to that org.
 *
 * Keyed by the authenticated user's `sub` so a saved choice is never applied
 * to a different account sharing the same browser profile.
 */
const STORAGE_KEY_PREFIX = "messaging-admin:last-selected-org:"

function storageKey(userSub: string): string {
  return `${STORAGE_KEY_PREFIX}${userSub}`
}

/**
 * Read the last organization the given user selected, or null when there is
 * no saved value (or storage is unavailable).
 */
export function readLastSelectedOrganization(
  userSub: string | undefined,
): string | null {
  if (!userSub || typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(storageKey(userSub))
  } catch {
    // localStorage can throw (privacy mode, disabled storage) — treat as absent.
    return null
  }
}

/**
 * Persist the organization the given user just selected so it can be restored
 * after a future logout/login. Best-effort: a failure to write just means we
 * fall back to the gateway cookie / first-org default next time.
 */
export function persistLastSelectedOrganization(
  userSub: string | undefined,
  organizationId: string | undefined,
): void {
  if (!userSub || !organizationId || typeof window === "undefined") return
  try {
    window.localStorage.setItem(storageKey(userSub), organizationId)
  } catch {
    // Ignore — see readLastSelectedOrganization.
  }
}
