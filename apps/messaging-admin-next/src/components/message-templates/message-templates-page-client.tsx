"use client"

import { Heading, Stack } from "@ogcio/design-system-react"
import { useTranslations } from "next-intl"
import TemplatesList from "@/components/message-templates/TemplatesList"
import { defaultFormGap } from "@/util/datetime"

export function MessageTemplatesPageClient() {
  const t = useTranslations("template.heading")

  return (
    <Stack direction='column' gap={defaultFormGap}>
      <Heading>{t("main")}</Heading>
      <TemplatesList />
    </Stack>
  )
}
