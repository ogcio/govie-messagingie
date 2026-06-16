"use client"

import { Link } from "@ogcio/design-system-react"
import { useTranslations } from "next-intl"
import { useCallback } from "react"

export function BackButton() {
  const t = useTranslations("navigation.back")

  const goBack = useCallback(() => {
    window.history.back()
  }, [])

  return (
    <Link
      noColor
      iconStart='chevron_left'
      href='#'
      aria-label={t("ariaLabel")}
      onClick={(e: React.MouseEvent) => {
        e.preventDefault()
        goBack()
      }}
    >
      {t("ariaLabel")}
    </Link>
  )
}
