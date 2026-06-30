import { AVAILABLE_LOCALES } from "@/const"

/**
 * Citizen-portal zones.
 *
 * The unified app serves all three from one static export. Nginx (Phase
 * D) maps each public hostname to the matching `/[locale]/...` entry,
 * but at the React layer the active zone has to be derived from the
 * current path — there is no hostname signal inside the bundle.
 *
 * Why a derived enum rather than a server constant: the alternative is
 * `process.env.zone` baked at build time (what the zones did pre-B2),
 * which breaks the moment one static export serves multiple zones.
 */
export type Zone = "messages" | "profile" | "dashboard"

const ZONE_BY_FIRST_SEGMENT: Record<string, Zone> = {
  messages: "messages",
  "secure-messages": "messages",
  "my-profile": "profile",
  "accessibility-statement": "profile",
  "contact-support": "profile",
  "cookie-policy": "profile",
  "wrong-account-error": "profile",
  "wrong-login-method-error": "profile",
  "global-signout": "profile",
  "my-dashboard": "dashboard",
}

/**
 * Resolves the active zone from a route pathname.
 *
 * Examples:
 *   /en/messages              -> "messages"
 *   /en/messages/secure-...   -> "messages"
 *   /ga/my-profile            -> "profile"
 *   /en/accessibility-...     -> "profile"  (public profile-owned page)
 *   /en/my-dashboard          -> "dashboard"
 *   /en                       -> "dashboard" (locale root → dashboard home)
 *   /onboarding               -> "profile"  (no-locale profile page)
 *
 * Pathnames that don't match a known zone segment fall back to
 * "dashboard" because the dashboard is the canonical landing surface.
 */
export function getZoneFromPath(pathname: string): Zone {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length === 0) return "dashboard"

  // First segment is the locale on /{locale}/{route}/... paths; the
  // route segment we care about is at index 1. For paths that skip the
  // locale (e.g. /onboarding, /api/clear-session, /post-global-signout)
  // the route segment is at index 0.
  const firstIsLocale = (AVAILABLE_LOCALES as readonly string[]).includes(
    segments[0],
  )
  const routeSegment = firstIsLocale ? (segments[1] ?? "") : segments[0]

  // Profile-owned no-locale routes.
  if (
    routeSegment === "onboarding" ||
    routeSegment === "post-global-signout" ||
    routeSegment === "global-signout" ||
    routeSegment === "wrong-login-method-error" ||
    routeSegment === "api"
  ) {
    return "profile"
  }

  return ZONE_BY_FIRST_SEGMENT[routeSegment] ?? "dashboard"
}
