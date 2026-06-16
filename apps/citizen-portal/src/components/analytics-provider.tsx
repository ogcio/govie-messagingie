"use client"

import { AnalyticsProvider as MatomoAnalyticsProvider } from "@ogcio/nextjs-analytics"
import type { ReactNode } from "react"
import { env } from "@/env/env.client"

/**
 * Matomo / @ogcio/nextjs-analytics wrapper used by every zone.
 *
 * Unified from messages' `MessagingAnalyticsProvider` and profile's
 * `AnalyticsProviderWrapper` in Phase B2. The messages version owned
 * the only non-trivial logic — the `NEXT_PUBLIC_ANALYTICS_URL` ||
 * `(NEXT_PUBLIC_MATOMO_URL + same-origin proxy)` fallback — so it
 * stays; profile's simpler config was a strict subset.
 *
 * No-ops when URL or website id are unset (e.g. local dev without
 * analytics env), so it's safe to mount unconditionally from the
 * shared `ClientShell`.
 */
function getAnalyticsBaseUrl(): string | undefined {
  if (env.NEXT_PUBLIC_ANALYTICS_URL) {
    return env.NEXT_PUBLIC_ANALYTICS_URL
  }
  const matomo = env.NEXT_PUBLIC_MATOMO_URL
  const protocol = env.NEXT_PUBLIC_MATOMO_PROTOCOL
  if (matomo?.startsWith("//") && protocol) {
    // Same-origin `/_next/analytics-api` is proxied (nginx in Docker,
    // rewrites in `next dev`) to analytics.ogcio.gov.ie so the SDK's
    // GET /api/v1/websites/{id} is not blocked by CORS. Use /_next/…
    // so CDN/WAF allows the path (ad-hoc prefixes can return 403 at
    // the edge).
    const origin = new URL(env.NEXT_PUBLIC_BASE_URL).origin
    return `${origin}/_next/analytics-api`
  }
  return undefined
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const baseUrl = getAnalyticsBaseUrl()
  const websiteId = env.NEXT_PUBLIC_ANALYTICS_WEBSITE_ID

  if (!baseUrl || !websiteId) {
    return <>{children}</>
  }

  return (
    <MatomoAnalyticsProvider
      config={{
        baseUrl,
        trackingWebsiteId: websiteId,
        organizationId: env.NEXT_PUBLIC_ANALYTICS_ORGANIZATION_ID,
        dryRun: env.NEXT_PUBLIC_ANALYTICS_DRY_RUN,
      }}
    >
      {/* @ogcio/nextjs-analytics types target React 18; React 19 children are compatible at runtime */}
      {children as never}
    </MatomoAnalyticsProvider>
  )
}
