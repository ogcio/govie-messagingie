"use client"

import { Heading, Paragraph, Spinner, Stack } from "@ogcio/design-system-react"
import { useGatewayFetch } from "@ogcio/sag-client/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useMemo } from "react"
import { BackLink } from "@/components/profile-admin/navigation/back-link"
import { ServerError } from "@/components/profile-admin/server-error"
import {
  buildPaging,
  usePaginationParams,
} from "@/hooks/profile-admin/use-pagination"
import type { ApiServiceUserProfileImport } from "@/types"
import { formatDate, formatTime } from "@/util/profile-admin/date"
import { url as buildUrl } from "@/util/profile-admin/url"
import { ServiceUsersImportDetailsTable } from "./service-users-import-details-table"
import { StatusTag } from "./status-tag"

export function ServiceUserImport() {
  const searchParams = useSearchParams()
  const importId = searchParams.get("id")?.trim() ?? ""
  const router = useRouter()
  const tNavigation = useTranslations("navigation")
  const t = useTranslations("serviceUserImport")
  const locale = useLocale()
  const url = buildUrl(locale)
  const { page, size } = usePaginationParams()

  useEffect(() => {
    if (!importId) {
      router.replace(url.serviceUsers.list)
    }
  }, [importId, router, url.serviceUsers.list])

  const {
    data: profileImport,
    error,
    isLoading,
  } = useGatewayFetch<ApiServiceUserProfileImport>(
    importId ? `/profile/api/v1/profiles/imports/${importId}` : null,
  )

  const totalCount = profileImport?.details?.length ?? 0
  const paging = useMemo(
    () => buildPaging(totalCount, page, size),
    [totalCount, page, size],
  )

  const paginatedDetails = useMemo(() => {
    if (!profileImport?.details) return []
    const startIndex = (paging.currentPage - 1) * size
    return profileImport.details.slice(startIndex, startIndex + size)
  }, [profileImport, paging.currentPage, size])

  if (!importId) {
    return null
  }

  if (isLoading && !profileImport) {
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
      <Stack direction='column' gap={2}>
        <Stack direction='row' gap={2}>
          <Paragraph>
            <span className='gi-font-bold'>{t("attributes.fileName")}:</span>
          </Paragraph>
          <Paragraph>{profileImport?.metadata?.filename}</Paragraph>
        </Stack>
        <Stack direction='row' gap={2}>
          <Paragraph>
            <span className='gi-font-bold'>{t("attributes.importedAt")}:</span>
          </Paragraph>
          <Paragraph>
            {[
              formatDate(profileImport?.createdAt),
              formatTime(profileImport?.createdAt),
            ]
              .filter(Boolean)
              .join(" ")}
          </Paragraph>
        </Stack>
        <Stack direction='row' gap={2}>
          <Paragraph>
            <span className='gi-font-bold'>{t("attributes.status")}:</span>
          </Paragraph>
          <Paragraph>
            {profileImport?.status && (
              <StatusTag status={profileImport.status} />
            )}
          </Paragraph>
        </Stack>
      </Stack>
      <ServiceUsersImportDetailsTable
        details={paginatedDetails}
        paging={paging}
      />
      <BackLink href={url.serviceUsers.list}>{tNavigation("back")}</BackLink>
    </Stack>
  )
}
