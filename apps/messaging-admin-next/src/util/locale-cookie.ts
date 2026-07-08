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
 * Build the synchronous bootstrap script injected before first paint. It sets
 * `document.documentElement.lang` (avoiding a flash of the wrong locale) and
 * persists the locale to a `NEXT_LOCALE` cookie scoped to the shared parent
 * domain, so the preference survives cross-app and bare-path landings. The
 * shared parent domain is derived at runtime from `location.hostname`,
 * mirroring the sign-out cookies; a host-only cookie is always written too.
 *
 * `locale` originates from `generateStaticParams` (only "en" / "ga"), so
 * interpolation is safe; values are JSON-encoded regardless.
 */
export function localeBootstrapScript(locale: Locale): string {
  const lang = JSON.stringify(locale)
  const name = JSON.stringify(NEXT_LOCALE_COOKIE)
  return `document.documentElement.lang=${lang};(function(){var p=location.hostname.split("."),d=p.length>=3?"."+p.slice(1).join("."):"",s=location.protocol==="https:"?"; Secure":"",b=${name}+"="+${lang}+"; path=/; max-age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax"+s;document.cookie=b;if(d){document.cookie=b+"; domain="+d;}})();`
}
