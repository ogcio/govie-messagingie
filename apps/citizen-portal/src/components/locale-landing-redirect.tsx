"use client"

import { useEffect } from "react"
import { ZONE_CONFIG } from "@/lib/zone-config"
import { withForceConsent } from "@/util/force-consent"
import { getZoneFromOrigin } from "@/util/get-zone-from-origin"

/**
 * Client-side landing redirect for `/{locale}/` — extracted from the
 * route module so the route itself can stay a server component and
 * keep its `generateStaticParams` export (Next.js disallows the two
 * in the same file).
 *
 * Hostname → destination:
 *   messaging.X → /{locale}/messages   (preserves ?force-consent=1)
 *   profile.X   → /{locale}/my-profile
 *   dashboard.X → /{locale}/my-dashboard
 *
 * Falls back to the dashboard root on unknown hostnames. Uses
 * `window.location.replace` so the redirect entry stays out of history.
 */
export function LocaleLandingRedirect({ locale }: { locale: string }) {
  useEffect(() => {
    const zone = getZoneFromOrigin()
    const target = `/${locale}${ZONE_CONFIG[zone].rootPath}`
    const dest = zone === "messages" ? withForceConsent(target) : target
    window.location.replace(dest)
  }, [locale])

  return (
    <noscript>
      <p>
        <a href={`/${locale}/messages`}>Continue</a>
      </p>
    </noscript>
  )
}
