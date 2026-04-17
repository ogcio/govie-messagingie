"use client"

import { Icon, Link, Stack } from "@ogcio/design-system-react"
import { useTranslations } from "next-intl"
import { useCallback } from "react"

export function BackButton() {
  const t = useTranslations("navigation.back")

  const goBack = useCallback(() => {
    window.history.back()
  }, [])

  return (
    <Stack direction='row' gap={0} aria-label={t("ariaLabel")}>
      <Icon icon='chevron_left' size='md' />
      <Link
        noColor
        href='#'
        onClick={(e: React.MouseEvent) => {
          e.preventDefault()
          goBack()
        }}
      >
        {t("ariaLabel")}
      </Link>
    </Stack>
  )
}
