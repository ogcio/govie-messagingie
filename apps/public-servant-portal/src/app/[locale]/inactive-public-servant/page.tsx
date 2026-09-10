"use client"

import { Heading, Paragraph, Stack } from "@ogcio/design-system-react"
import { useTranslations } from "next-intl"
import { defaultFormGap } from "@/util/datetime"

export default function InactivePublicServantPage() {
  const t = useTranslations("InactivePublicServant")

  return (
    <Stack direction='column' gap={defaultFormGap}>
      <Heading>{t("title")}</Heading>
      <Paragraph>{t("description")}</Paragraph>
    </Stack>
  )
}
