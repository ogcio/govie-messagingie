import { AVAILABLE_LOCALES, NEXT_LOCALE_COOKIE } from "@/const"

type Locale = (typeof AVAILABLE_LOCALES)[number]

// Persist the choice for a year — long enough to feel "sticky" across
// sessions, short enough to age out for shared devices.
const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

function isLocale(value: string | null | undefined): value is Locale {
  return (
    value != null && (AVAILABLE_LOCALES as readonly string[]).includes(value)
  )
}

/**
 * Derive the parent domain the locale cookie should be scoped to so a choice
 * made on one citizen-portal subdomain (messaging / profile / dashboard) is
 * readable by its siblings. Mirrors the shared-domain derivation used by the
 * sign-out cookies (`post-global-signout.tsx`). Returns undefined for hosts
 * without a shared parent (e.g. `localhost`), yielding a host-only cookie.
 */
function getSharedDomain(hostname: string): string | undefined {
  const parts = hostname.split(".")
  return parts.length >= 3 ? `.${parts.slice(1).join(".")}` : undefined
}

/**
 * Read the persisted locale preference, if any. Returns null when the cookie
 * is absent or holds an unsupported value, so callers can fall back to the
 * browser language.
 */
export function readLocaleCookie(): Locale | null {
  if (typeof document === "undefined") return null
  const prefix = `${NEXT_LOCALE_COOKIE}=`
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim()
    if (trimmed.startsWith(prefix)) {
      const value = decodeURIComponent(trimmed.slice(prefix.length))
      return isLocale(value) ? value : null
    }
  }
  return null
}

/**
 * Persist the chosen locale to a cookie scoped to the shared parent domain so
 * the preference survives cross-app and bare-path landings. Always sets a
 * host-only cookie too, so it works on hosts without a shared parent.
 */
export function writeLocaleCookie(locale: Locale): void {
  if (typeof document === "undefined") return
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  const base = `${NEXT_LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`
  document.cookie = base
  const domain = getSharedDomain(window.location.hostname)
  if (domain) {
    document.cookie = `${base}; domain=${domain}`
  }
}
