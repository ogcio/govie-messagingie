"use client"

import { AnalyticsProvider } from "@ogcio/nextjs-analytics"
import type { ReactNode } from "react"
import { env } from "@/env/env.client"

export function AnalyticsProviderWrapper({
  children,
}: {
  children: ReactNode
}) {
  const baseUrl = env.NEXT_PUBLIC_ANALYTICS_URL

  if (!baseUrl) {
    return <>{children}</>
  }

  const config = {
    baseUrl,
    trackingWebsiteId: env.NEXT_PUBLIC_ANALYTICS_WEBSITE_ID ?? "",
    organizationId: env.NEXT_PUBLIC_ANALYTICS_ORGANIZATION_ID ?? "",
    dryRun: env.NEXT_PUBLIC_ANALYTICS_DRY_RUN,
  }

  return (
    <AnalyticsProvider config={config}>
      {children as React.ReactNode & React.ReactElement}
    </AnalyticsProvider>
  )
}
