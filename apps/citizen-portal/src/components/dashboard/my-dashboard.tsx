"use client"

import { Heading, Paragraph, Stack } from "@ogcio/design-system-react"
import { useAuth } from "@ogcio/sag-client/react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { TwoColumnLayout } from "@/components/layout/containers"
import { BoldLink } from "@/components/navigation/bold-link"
import { usePublicName } from "@/hooks/use-public-name"
import { isZoneEnabled } from "@/lib/feature-config"
import govieLogo from "@/public/govie.png"
import { MyMessages } from "./my-messages"

/**
 * Dashboard landing — left column is the welcome heading + recent
 * messages, right column is the gov.ie help card. `TwoColumnLayout`
 * (from the unified containers module) collapses to a single column
 * below the twelve-column breakpoint.
 */
export function MyDashboard() {
  const { user } = useAuth()
  const t = useTranslations("dashboard")
  const displayName = usePublicName(user)

  return (
    <TwoColumnLayout>
      <Stack direction='column' gap={5}>
        <Heading as='h2'>{t("welcome", { name: displayName })}</Heading>
        {isZoneEnabled("messages") ? <MyMessages /> : null}
      </Stack>

      <Stack direction='column' gap={5}>
        <Heading as='h2'>{t("help.title")}</Heading>
        <Stack direction='column' gap={5}>
          <Image src={govieLogo} alt='Gov.ie' />
          <Paragraph>{t("help.description")}</Paragraph>
          <BoldLink href='https://www.gov.ie' external>
            {t("help.link")}
          </BoldLink>
        </Stack>
      </Stack>
    </TwoColumnLayout>
  )
}
