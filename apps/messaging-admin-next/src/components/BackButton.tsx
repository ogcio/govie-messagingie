/** biome-ignore-all lint/correctness/useHookAtTopLevel: maintaining old code */
"use client"
import { Icon, Link, Stack } from "@ogcio/design-system-react"
import { useAnalytics } from "@ogcio/nextjs-analytics"
import { useTranslations } from "next-intl"
import type { PropsWithChildren } from "react"
import { ANALYTICS } from "@/const/analytics"

export const BackLink = (props: PropsWithChildren<{ href: string }>) => {
  if (!props.children) {
    return null
  }

  const analyticsClient = useAnalytics()
  const t = useTranslations("navigation.backLink")
  return (
    <Stack direction='row' gap={0} aria-label={t("ariaLabel")}>
      <Icon icon='chevron_left' size='md' />
      <Link
        noColor
        href={props.href}
        onClick={() => {
          analyticsClient.trackEvent({
            event: {
              name: ANALYTICS.message.back.name,
              category: ANALYTICS.message.category,
              action: ANALYTICS.message.back.action,
            },
          })
        }}
      >
        {props.children}
      </Link>
    </Stack>
  )
}

export const BackButton = (
  props: PropsWithChildren<{ onClick: () => void }>,
) => {
  if (!props.children) {
    return null
  }

  const analyticsClient = useAnalytics()

  return (
    <Stack direction='row' gap={0}>
      <Icon icon='chevron_left' size='md' />
      <Link
        noColor
        onClick={() => {
          analyticsClient.trackEvent({
            event: {
              name: ANALYTICS.message.back.name,
              category: ANALYTICS.message.category,
              action: ANALYTICS.message.back.action,
            },
          })
          props.onClick()
        }}
        style={{ cursor: "pointer" }}
      >
        {props.children}
      </Link>
    </Stack>
  )
}
