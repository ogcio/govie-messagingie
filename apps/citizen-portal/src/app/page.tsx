"use client"

import { useEffect } from "react"
import { DEFAULT_LOCALE } from "@/const"
import { useLocalePreference } from "@/hooks/use-locale-preference"
import { ZONE_CONFIG } from "@/lib/zone-config"
import { withForceConsent } from "@/util/force-consent"
import { getZoneFromOrigin } from "@/util/get-zone-from-origin"

/**
 * Root redirect page — zone-aware.
 *
 * Hit when the user lands at the bare hostname with no locale prefix.
 * Detects the browser locale, picks the destination from the active
 * zone's `rootPath`, and replaces the URL so the redirect entry stays
 * out of history.
 *
 * For users with JavaScript disabled, a plain anchor to the messages
 * zone in the default locale is the fallback (best guess in the
 * absence of both runtime hostname matching and a real browser).
 */
export default function RootPage() {
  const { locale, isReady } = useLocalePreference()

  useEffect(() => {
    if (!isReady) return
    const zone = getZoneFromOrigin()
    const target = `/${locale}${ZONE_CONFIG[zone].rootPath}`
    const dest = zone === "messages" ? withForceConsent(target) : target
    window.location.replace(dest)
  }, [locale, isReady])

  return (
    <noscript>
      <p>
        <a href={`/${DEFAULT_LOCALE}/messages`}>Continue to messages</a>
      </p>
    </noscript>
  )
}
