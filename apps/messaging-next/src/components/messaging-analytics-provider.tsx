"use client"

import { AnalyticsProvider } from "@ogcio/nextjs-analytics"
import type { ReactNode } from "react"
import { env } from "@/env/env.client"

function getAnalyticsBaseUrl(): string | undefined {
  if (env.NEXT_PUBLIC_ANALYTICS_URL) {
    return env.NEXT_PUBLIC_ANALYTICS_URL
  }
  const matomo = env.NEXT_PUBLIC_MATOMO_URL
  const protocol = env.NEXT_PUBLIC_MATOMO_PROTOCOL
  if (matomo?.startsWith("//") && protocol) {
    // Same-origin `/_next/analytics-api` is proxied (nginx in Docker, rewrites in `next dev`) to
    // analytics.ogcio.gov.ie so the SDK’s GET /api/v1/websites/{id} is not blocked by CORS.
    // Use /_next/… so CDN/WAF allows the path (ad-hoc prefixes can return 403 at the edge).
    const origin = new URL(env.NEXT_PUBLIC_BASE_URL).origin
    return `${origin}/_next/analytics-api`
  }
  return undefined
}

/**
 * Matomo / @ogcio/nextjs-analytics — mirrors legacy messaging `LayoutContent`.
 * No-ops when URL or website id are unset (e.g. local dev without analytics env).
 */
export function MessagingAnalyticsProvider({
  children,
}: {
  children: ReactNode
}) {
  const baseUrl = getAnalyticsBaseUrl()
  const websiteId = env.NEXT_PUBLIC_ANALYTICS_WEBSITE_ID

  if (!baseUrl || !websiteId) {
    return <>{children}</>
  }

  return (
    <AnalyticsProvider
      config={{
        baseUrl,
        trackingWebsiteId: websiteId,
        organizationId: env.NEXT_PUBLIC_ANALYTICS_ORGANIZATION_ID,
        dryRun: env.NEXT_PUBLIC_ANALYTICS_DRY_RUN,
      }}
    >
      {/* @ogcio/nextjs-analytics types target React 18; React 19 children are compatible at runtime */}
      {children as never}
    </AnalyticsProvider>
  )
}
