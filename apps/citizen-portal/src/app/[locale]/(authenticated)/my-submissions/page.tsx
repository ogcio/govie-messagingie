"use client"

import { useLocale } from "next-intl"
import { Suspense, useEffect } from "react"
import { PageLoading } from "@/components/page-loading"
import { SubmissionsPage } from "@/components/submissions/submissions"
import {
  getEnabledLandingZone,
  isLeaEnabled,
  isZoneEnabled,
} from "@/lib/feature-config"
import { ZONE_CONFIG } from "@/lib/zone-config"

/**
 * Submissions route — part of the dashboard zone.
 *
 * Gated by both the dashboard topology flag (AB#39580) and the LEA flag
 * (AB#39421/40267): the submissions surface only exists in LEA-enabled
 * builds (dev/uat). The route is present in every static export, so a
 * direct visit when the gate is off is steered client-side to the first
 * enabled landing zone (same pattern as the dashboard landing route), with
 * a `<noscript>` link so it is never a dead end without JS.
 */
export default function MySubmissionsPage() {
  const locale = useLocale()
  const enabled = isZoneEnabled("dashboard") && isLeaEnabled()

  useEffect(() => {
    if (enabled) return
    const target = getEnabledLandingZone("dashboard")
    window.location.replace(`/${locale}${ZONE_CONFIG[target].rootPath}`)
  }, [enabled, locale])

  if (!enabled) {
    const fallbackPath = `/${locale}${ZONE_CONFIG[getEnabledLandingZone("dashboard")].rootPath}`
    return (
      <>
        <PageLoading minHeight='50vh' />
        <noscript>
          <a href={fallbackPath}>Continue</a>
        </noscript>
      </>
    )
  }

  return (
    <Suspense>
      <SubmissionsPage />
    </Suspense>
  )
}
