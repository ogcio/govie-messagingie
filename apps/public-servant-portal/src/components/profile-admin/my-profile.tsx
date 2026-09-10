"use client"

import {
  Heading,
  Link,
  Paragraph,
  Spinner,
  Stack,
  SummaryList,
  SummaryListAction,
  SummaryListRow,
  SummaryListValue,
} from "@ogcio/design-system-react"
import { useAuth, useGatewayFetch } from "@ogcio/sag-client/react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { TwoColumnLayout } from "@/components/profile-admin/layout/containers"
import { ServerError } from "@/components/profile-admin/server-error"
import type { ApiProfileUser } from "@/types"
import { stringToAsterisk } from "@/util/profile-admin/strings"

const PPSN_REVEAL_PARAM = "ppsn"

export function MyProfile() {
  const { user } = useAuth()
  const t = useTranslations("profile")
  const searchParams = useSearchParams()
  const isPpsnRevealed = searchParams.get(PPSN_REVEAL_PARAM) === "1"

  const sub = user?.sub
  const {
    data: profile,
    error,
    isLoading,
  } = useGatewayFetch<ApiProfileUser>(
    sub ? `/profile/api/v1/profiles/${sub}` : null,
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
    return <ServerError error={error?.message ?? String(error)} />
  }

  return (
    <TwoColumnLayout>
      <Stack direction='column' gap={8}>
        <Heading as='h1' size='lg'>
          {t("title")}
        </Heading>
        <Paragraph>{t("information")}</Paragraph>
        {(profile?.details?.firstName || profile?.details?.lastName) && (
          <>
            <Heading as='h2' size='sm'>
              {t("name")}
            </Heading>
            <SummaryList>
              {profile.details.firstName && (
                <SummaryListRow withBorder label={t("firstName")}>
                  <SummaryListValue>
                    {profile.details.firstName}
                  </SummaryListValue>
                </SummaryListRow>
              )}
              {profile.details.lastName && (
                <SummaryListRow withBorder label={t("lastName")}>
                  <SummaryListValue>
                    {profile.details.lastName}
                  </SummaryListValue>
                </SummaryListRow>
              )}
            </SummaryList>
          </>
        )}

        {!!profile?.details?.ppsn?.trim() && (
          <>
            <Heading as='h2' size='sm'>
              {t("ppsn")}
            </Heading>
            <SummaryList>
              <SummaryListRow withBorder label={t("ppsn")}>
                <SummaryListValue>
                  {isPpsnRevealed
                    ? profile.details.ppsn
                    : stringToAsterisk("ppsn")}
                </SummaryListValue>
                <SummaryListAction>
                  {isPpsnRevealed ? (
                    <Link href='?' className='gi-link'>
                      {t("clickToHide")}
                    </Link>
                  ) : (
                    <Link href={`?${PPSN_REVEAL_PARAM}=1`} className='gi-link'>
                      {t("clickToReveal")}
                    </Link>
                  )}
                </SummaryListAction>
              </SummaryListRow>
            </SummaryList>
          </>
        )}

        {profile?.email && (
          <>
            <Heading as='h2' size='sm'>
              {t("contactDetails")}
            </Heading>
            <SummaryList>
              <SummaryListRow withBorder label={t("email")}>
                <SummaryListValue>{profile.email}</SummaryListValue>
              </SummaryListRow>
            </SummaryList>
          </>
        )}
      </Stack>
    </TwoColumnLayout>
  )
}
