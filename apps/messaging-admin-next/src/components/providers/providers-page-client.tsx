"use client"

import { Heading, Link, Stack } from "@ogcio/design-system-react"
import { useLocale, useTranslations } from "next-intl"
import EmailProviders from "@/components/providers/EmailProviders"
import { defaultFormGap } from "@/util/datetime"
import { url } from "@/util/url"

export function ProvidersPageClient() {
  const locale = useLocale()
  const t = useTranslations("settings.Page")

  return (
    <Stack direction='column' gap={defaultFormGap}>
      <Heading>{t("header")}</Heading>
      <Link href={url(locale).providers.email()} noUnderline asButton={{}}>
        {t("addProvider")}
      </Link>
      <EmailProviders />
    </Stack>
  )
}
