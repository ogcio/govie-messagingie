"use client"

import { Heading, Paragraph, Stack, toaster } from "@ogcio/design-system-react"
import { useAnalytics } from "@ogcio/nextjs-analytics"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useRef } from "react"
import { ANALYTICS } from "@/const/analytics"

export function ServerError({
  error,
  redirectTo,
}: {
  error: string
  redirectTo?: string
}) {
  const t = useTranslations("errors")
  const currentError = useRef<string | null>(null)
  const analyticsClient = useAnalytics()
  const router = useRouter()

  useEffect(() => {
    analyticsClient.trackEvent({
      event: {
        name: ANALYTICS.system.error.name,
        category: ANALYTICS.system.category,
        action: ANALYTICS.system.error.action,
      },
    })
  }, [analyticsClient])

  useEffect(() => {
    if (error && error !== currentError.current) {
      toaster.create({
        position: { x: "right", y: "top" },
        title: t("server"),
        description: error,
        variant: "danger",
      })
    }
    currentError.current = error
  }, [error, t])

  useEffect(() => {
    if (redirectTo) {
      router.push(redirectTo)
    }
  }, [redirectTo, router])

  return (
    <Stack direction='column' gap={8}>
      <Heading as='h2'>{t("server")}</Heading>
      <Paragraph>{error}</Paragraph>
    </Stack>
  )
}
