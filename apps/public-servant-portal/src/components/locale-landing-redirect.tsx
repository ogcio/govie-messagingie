"use client"

import { useEffect } from "react"
import { getZoneFromHostname, ZONE_DEFAULT_PATH } from "@/util/zone"

/**
 * Client-side landing redirect for `/{locale}/`.
 *
 * The unified portal is served from two hostnames but ships a single
 * static export, so the per-zone default landing is resolved in JS from
 * `window.location.hostname`:
 *
 *   messaging-admin.* → /{locale}/send-a-message
 *   profile-admin.*   → /{locale}/service-users
 *
 * Extracted from the route module so the route itself can stay a server
 * component and keep its `generateStaticParams` export (Next.js disallows
 * the two in the same file).
 */
export function LocaleLandingRedirect({ locale }: { locale: string }) {
  useEffect(() => {
    const zone = getZoneFromHostname(window.location.hostname)
    window.location.replace(`/${locale}/${ZONE_DEFAULT_PATH[zone]}`)
  }, [locale])

  return (
    <noscript>
      <p>
        <a href={`/${locale}/send-a-message`}>Continue</a>
      </p>
    </noscript>
  )
}
