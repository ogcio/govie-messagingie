"use client"

import { Spinner } from "@ogcio/design-system-react"
import { useLocale } from "next-intl"
import { Suspense, useEffect } from "react"
import { MyDashboard } from "@/components/dashboard/my-dashboard"
import { getEnabledLandingZone, isZoneEnabled } from "@/lib/feature-config"
import { ZONE_CONFIG } from "@/lib/zone-config"

/**
 * Dashboard landing route.
 *
 * The route exists in every static export, but when the dashboard zone is
 * disabled for this deployment (AB#39580) a direct visit is steered to
 * the first enabled landing zone instead of rendering the (absent)
 * dashboard surface. The app is a static export with no server, so the
 * redirect is client-side (same pattern as `LocaleLandingRedirect`); we
 * render a spinner rather than a blank page while it fires, and a
 * `<noscript>` link so the page is never a dead end without JS.
 */
export default function MyDashboardPage() {
  const locale = useLocale()
  const dashboardEnabled = isZoneEnabled("dashboard")

  useEffect(() => {
    if (dashboardEnabled) return
    const target = getEnabledLandingZone("dashboard")
    window.location.replace(`/${locale}${ZONE_CONFIG[target].rootPath}`)
  }, [dashboardEnabled, locale])

  if (!dashboardEnabled) {
    const fallbackPath = `/${locale}${ZONE_CONFIG[getEnabledLandingZone("dashboard")].rootPath}`
    return (
      <output
        aria-label='Loading'
        className='gi-flex gi-items-center gi-justify-center'
        style={{ minHeight: "50vh" }}
      >
        <Spinner size='xl' />
        <noscript>
          <a href={fallbackPath}>Continue</a>
        </noscript>
      </output>
    )
  }

  return (
    <Suspense>
      <MyDashboard />
    </Suspense>
  )
}
