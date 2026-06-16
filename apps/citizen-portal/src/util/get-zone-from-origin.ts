"use client"

import { getEnv } from "@citizen-portal/shared"
import type { Zone } from "@/util/get-zone-from-path"

/**
 * Resolves the active zone from `window.location.origin` by comparing
 * it against the shared zone host map (`NEXT_PUBLIC_MESSAGING_URL` /
 * `NEXT_PUBLIC_PROFILE_URL` / `NEXT_PUBLIC_DASHBOARD_URL`).
 *
 * Why a separate helper from `getZoneFromPath`: pathnames like
 * `/{locale}/` or `/` carry no zone signal — only the hostname does.
 * The two landing pages (`[locale]/page.tsx` and `app/page.tsx`) hit
 * exactly that case, so they pick the right per-zone redirect target
 * via this helper. Everywhere else in the bundle, the active route
 * segment is unambiguous and `getZoneFromPath` is the right answer.
 *
 * Falls back to `"dashboard"` on the server (no window), on a host
 * that doesn't match any zone (e.g. local dev with a custom domain),
 * or when the env URLs themselves don't parse.
 */
export function getZoneFromOrigin(): Zone {
  if (typeof window === "undefined") return "dashboard"

  const { hosts } = getEnv()
  const origin = window.location.origin

  for (const zone of ["messages", "profile", "dashboard"] as const) {
    try {
      if (new URL(hosts[zone]).origin === origin) return zone
    } catch {
      // Malformed env URL — skip; the next zone (or fallback) wins.
    }
  }

  return "dashboard"
}
