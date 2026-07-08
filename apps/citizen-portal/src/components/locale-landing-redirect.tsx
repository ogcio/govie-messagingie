"use client"

import { useEffect } from "react"
import { getEnabledLandingZone } from "@/lib/feature-config"
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
 * Falls back to the dashboard root on unknown hostnames. When a zone is
 * disabled for this deployment (AB#39580), the redirect is steered to the
 * first enabled fallback zone via `getEnabledLandingZone`, so we never
 * land on a zone this build does not ship. Uses `window.location.replace`
 * so the redirect entry stays out of history.
 */
export function LocaleLandingRedirect({ locale }: { locale: string }) {
  useEffect(() => {
    const zone = getEnabledLandingZone(getZoneFromOrigin())
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
