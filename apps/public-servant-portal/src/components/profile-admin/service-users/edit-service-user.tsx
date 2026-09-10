"use client"

import {
  Button,
  FormField,
  Heading,
  InputText,
  Spinner,
  Stack,
  SummaryList,
  SummaryListRow,
  SummaryListValue,
  toaster,
} from "@ogcio/design-system-react"
import { useGatewayFetch } from "@ogcio/sag-client/react"
import { useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import {
  FullWidthContainer,
  TwoColumnLayout,
} from "@/components/profile-admin/layout/containers"
import { BackLink } from "@/components/profile-admin/navigation/back-link"
import { ServerError } from "@/components/profile-admin/server-error"
import { env } from "@/env/env.client"
import { useOrganizationId } from "@/hooks/profile-admin/use-organization-id"
import type { ApiProfileUser } from "@/types"
import {
  getProfileImportErrorDetail,
  getProfileImportIdFromResponse,
  type ProfileImportApiResponse,
} from "@/util/profile-admin/profile-import-response"
import { url as buildUrl } from "@/util/profile-admin/url"
import { ZONE_SAG_APP_NAME } from "@/util/zone"

interface ImportProfileItem {
  email: string
  firstName: string
  lastName: string
  ppsn?: string
  preferredLanguage?: "en" | "ga"
}

interface UpdateProfilePayload {
  profiles: [ImportProfileItem]
}

export function EditServiceUser() {
  const t = useTranslations("serviceUser")
  const tNavigation = useTranslations("navigation")
  const locale = useLocale()
  const url = buildUrl(locale)
  const searchParams = useSearchParams()
  const profileId = searchParams.get("id") ?? ""
  const organizationId = useOrganizationId()

  const {
    data: profile,
    error: fetchError,
    isLoading: isFetching,
  } = useGatewayFetch<ApiProfileUser>(
    profileId ? `/profile/api/v1/profiles/${profileId}` : null,
  )

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [ppsn, setPpsn] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (profile?.details) {
      setFirstName(profile.details.firstName ?? "")
      setLastName(profile.details.lastName ?? "")
      setPpsn(profile.details.ppsn ?? "")
    }
  }, [profile])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!firstName) {
      setValidationError(t("attributes.firstName"))
      return
    }
    if (!lastName) {
      setValidationError(t("attributes.lastName"))
      return
    }
    setValidationError(null)

    if (!profile?.email) {
      setValidationError(t("attributes.email"))
      return
    }

    const payload: UpdateProfilePayload = {
      profiles: [
        {
          email: profile.email,
          firstName,
          lastName,
          ...(ppsn ? { ppsn } : {}),
          preferredLanguage: profile?.preferredLanguage ?? "en",
        },
      ],
    }

    setIsSubmitting(true)
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Application": ZONE_SAG_APP_NAME["profile-admin"],
      }
      if (organizationId) {
        headers["X-Organization-Id"] = organizationId
      }

      const response = await fetch(
        `${env.NEXT_PUBLIC_SAG_URL}/profile/api/v1/profiles/imports`,
        {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify(payload),
        },
      )

      const json = (await response
        .json()
        .catch(() => ({}))) as ProfileImportApiResponse
      const profileImportId = getProfileImportIdFromResponse(json)

      if (!response.ok || json.error || !profileImportId) {
        throw new Error(
          getProfileImportErrorDetail(json, t("actions.update.error")),
        )
      }

      toaster.create({
        position: { x: "right", y: "top" },
        title: t("actions.update.success"),
        variant: "success",
      })
    } catch (error) {
      toaster.create({
        position: { x: "right", y: "top" },
        title: t("actions.update.error"),
        description:
          error instanceof Error ? error.message : t("actions.update.error"),
        variant: "danger",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isFetching && !profile) {
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

  if (fetchError) {
    return (
      <ServerError
        error={fetchError?.message ?? String(fetchError)}
        redirectTo={url.serviceUsers.list}
      />
    )
  }

  return (
    <TwoColumnLayout>
      <Stack direction='column' gap={10}>
        <Heading>{t("title")}</Heading>
        <FullWidthContainer>
          <form onSubmit={handleSubmit}>
            <Stack direction='column' gap={6}>
              <Heading as='h2'>{t("sections.name.title")}</Heading>

              <FormField
                className='gi-w-full'
                label={{ text: t("attributes.firstName") }}
                error={
                  validationError === t("attributes.firstName")
                    ? { text: validationError }
                    : undefined
                }
              >
                <InputText
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  name='firstName'
                />
              </FormField>

              <FormField
                className='gi-w-full'
                label={{ text: t("attributes.lastName") }}
                error={
                  validationError === t("attributes.lastName")
                    ? { text: validationError }
                    : undefined
                }
              >
                <InputText
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  name='lastName'
                />
              </FormField>

              <Heading as='h2'>{t("sections.ppsn.title")}</Heading>
              <FormField
                className='gi-w-full'
                label={{ text: t("attributes.ppsn") }}
              >
                <InputText
                  value={ppsn}
                  onChange={(e) => setPpsn(e.target.value)}
                  name='ppsn'
                />
              </FormField>

              <div>
                <Button type='submit' disabled={isSubmitting}>
                  {t("actions.update.title")}
                  {isSubmitting && <Spinner />}
                </Button>
              </div>

              <Stack direction='column' gap={4}>
                <Heading as='h2'>{t("sections.email.title")}</Heading>
                <div className='gi-w-full'>
                  <SummaryList>
                    <SummaryListRow withBorder label='Email'>
                      <SummaryListValue>{profile?.email}</SummaryListValue>
                    </SummaryListRow>
                  </SummaryList>
                </div>
              </Stack>

              <BackLink href={url.serviceUsers.list}>
                {tNavigation("back")}
              </BackLink>
            </Stack>
          </form>
        </FullWidthContainer>
      </Stack>
    </TwoColumnLayout>
  )
}
