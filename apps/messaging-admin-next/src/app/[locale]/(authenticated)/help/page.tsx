"use client"

import {
  Heading,
  Link,
  List,
  Paragraph,
  Stack,
} from "@ogcio/design-system-react"
import { useLocale, useTranslations } from "next-intl"
import { env } from "@/env/env.client"
import { defaultFormGap } from "@/util/datetime"
import { url } from "@/util/url"

export default function HelpPage() {
  const locale = useLocale()
  const t = useTranslations("help")
  const serviceUsersUrl = new URL(
    `/${locale}/service-users`,
    env.NEXT_PUBLIC_PROFILE_ADMIN_URL,
  )
  const messageTemplatesUrl = new URL(
    url(locale).messageTemplates.list,
    env.NEXT_PUBLIC_BASE_URL,
  )

  return (
    <Stack direction='column' gap={defaultFormGap}>
      <Heading>{t("heading.welcome")}</Heading>
      <Heading as='h2'>{t("heading.templates")}</Heading>
      <Paragraph style={{ maxWidth: "unset" }}>
        {t.rich("paragraph.templates", {
          link: (chunks) => (
            <Link href={messageTemplatesUrl.href}>{chunks}</Link>
          ),
        })}
      </Paragraph>
      <Heading as='h2'>{t("heading.recipients")}</Heading>
      <Paragraph style={{ maxWidth: "unset" }}>
        {t.rich("paragraph.recipients", {
          link: (chunks) => <Link href={serviceUsersUrl.href}>{chunks}</Link>,
        })}
      </Paragraph>
      <Heading as='h2'>{t("heading.setupSteps")}</Heading>
      <List
        type='number'
        items={
          [
            t.rich("list.setupSteps.0", { b: (chunks) => <b>{chunks}</b> }),
            t("list.setupSteps.1"),
            t.rich("list.setupSteps.2", { b: (chunks) => <b>{chunks}</b> }),
            t("list.setupSteps.3"),
            t.rich("list.setupSteps.4", { b: (chunks) => <b>{chunks}</b> }),
            t.rich("list.setupSteps.5", { b: (chunks) => <b>{chunks}</b> }),
            t.rich("list.setupSteps.6", { b: (chunks) => <b>{chunks}</b> }),
          ] as Parameters<typeof List>[0]["items"]
        }
      />
      <Link
        href={url(locale).sendAMessage}
        asButton={{ appearance: "default" }}
      >
        {t("button.sendAMessage")}
      </Link>
    </Stack>
  )
}
