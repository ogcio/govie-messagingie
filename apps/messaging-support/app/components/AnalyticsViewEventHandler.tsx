"use client"

import { type TrackEventProps, useAnalytics } from "@ogcio/nextjs-analytics"
import { useEffect } from "react"

export function AnalyticsViewEventHandler(props: {
  event: TrackEventProps["event"]
  children: React.ReactNode
}) {
  const { children, event } = props
  const analyticsClient = useAnalytics()

  // biome-ignore lint/correctness/useExhaustiveDependencies: fire once on mount
  useEffect(() => {
    analyticsClient.trackEvent({ event })
  }, [])

  return children
}
