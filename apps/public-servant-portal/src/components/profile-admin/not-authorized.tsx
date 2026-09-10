"use client"

import { Heading, Paragraph, Stack } from "@ogcio/design-system-react"
import { useTranslations } from "next-intl"

export function NotAuthorized() {
  const t = useTranslations("notAuthorized")
  return (
    <Stack direction='column' gap={2}>
      <Heading as='h2'>{t("title")}</Heading>
      <Paragraph>{t("description")}</Paragraph>
    </Stack>
  )
}
