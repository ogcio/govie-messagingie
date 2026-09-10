"use client"

import { Heading, Paragraph, Spinner, Stack } from "@ogcio/design-system-react"
import { useGatewayFetch } from "@ogcio/sag-client/react"
import { useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { BackLink } from "@/components/profile-admin/navigation/back-link"
import { ServerError } from "@/components/profile-admin/server-error"
import type { ApiProfileUser } from "@/types"
import { url as buildUrl } from "@/util/profile-admin/url"

export function ServiceUser() {
  const searchParams = useSearchParams()
  const profileId = searchParams.get("id") ?? ""
  const tNavigation = useTranslations("navigation")
  const t = useTranslations("serviceUser")
  const locale = useLocale()
  const url = buildUrl(locale)

  const {
    data: profile,
    error,
    isLoading,
  } = useGatewayFetch<ApiProfileUser>(
    profileId ? `/profile/api/v1/profiles/${profileId}` : null,
  )

  if (isLoading && !profile) {
    return (
      <output
        aria-label='Loading'
        className='gi-flex gi-items-center gi-justify-center'
        style={{ minHeight: "30vh" }}
      >
        <Spinner size='xl' />
      </output>
    )
  }

  if (error) {
    return (
      <ServerError
        error={error?.message ?? String(error)}
        redirectTo={url.serviceUsers.list}
      />
    )
  }

  return (
    <Stack direction='column' gap={10}>
      <Heading>{t("title")}</Heading>
      <Stack direction='column' gap={4}>
        <Heading as='h4'>{t("sections.name.title")}</Heading>
        <Stack direction='row' gap={2}>
          <Paragraph>
            <span className='gi-font-bold'>{t("attributes.publicName")}:</span>
          </Paragraph>
          <Paragraph>{profile?.publicName}</Paragraph>
        </Stack>
        <Stack direction='row' gap={2}>
          <Paragraph>
            <span className='gi-font-bold'>{t("attributes.firstName")}:</span>
          </Paragraph>
          <Paragraph>{profile?.details?.firstName}</Paragraph>
        </Stack>
        <Stack direction='row' gap={2}>
          <Paragraph>
            <span className='gi-font-bold'>{t("attributes.lastName")}:</span>
          </Paragraph>
          <Paragraph>{profile?.details?.lastName}</Paragraph>
        </Stack>
      </Stack>
      <Stack direction='column' gap={4}>
        <Heading as='h4'>{t("sections.ppsn.title")}</Heading>
        <Stack direction='row' gap={2}>
          <Paragraph>
            <span className='gi-font-bold'>{t("attributes.ppsn")}:</span>
          </Paragraph>
          <Paragraph>{profile?.details?.ppsn}</Paragraph>
        </Stack>
      </Stack>
      <Stack direction='column' gap={4}>
        <Heading as='h4'>{t("sections.email.title")}</Heading>
        <Stack direction='row' gap={2}>
          <Paragraph>
            <span className='gi-font-bold'>{t("attributes.email")}:</span>
          </Paragraph>
          <Paragraph>{profile?.email}</Paragraph>
        </Stack>
      </Stack>
      <BackLink href={url.serviceUsers.list}>{tNavigation("back")}</BackLink>
    </Stack>
  )
}
