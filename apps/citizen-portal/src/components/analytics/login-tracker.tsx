"use client"

import { useAnalytics } from "@ogcio/nextjs-analytics"
import { useEffect, useRef } from "react"
import { ANALYTICS } from "@/const/analytics"

const SESSION_KEY = "citizen_portal_login_tracked"

/**
 * Fires a single "user-login" Matomo event per browser session.
 * Mounted inside AnalyticsProvider by AuthenticatedShell, which only
 * renders once the user is authenticated.
 */
export function LoginTracker() {
  const analyticsClient = useAnalytics()
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    try {
      if (typeof window.sessionStorage === "undefined") return
      if (window.sessionStorage.getItem(SESSION_KEY)) return
      window.sessionStorage.setItem(SESSION_KEY, "1")
    } catch {
      // storage unavailable (private mode edge cases) — skip rather than throw
      return
    }
    fired.current = true
    analyticsClient.trackEvent({
      event: {
        name: ANALYTICS.user.login.name,
        category: ANALYTICS.user.category,
        action: ANALYTICS.user.login.action,
      },
    })
  }, [analyticsClient])

  return null
}
