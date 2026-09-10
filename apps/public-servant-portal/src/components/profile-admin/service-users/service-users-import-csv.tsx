"use client"

import {
  Button,
  FormField,
  Heading,
  Paragraph,
  Spinner,
  Stack,
  toaster,
} from "@ogcio/design-system-react"
import { useAnalytics } from "@ogcio/nextjs-analytics"
import { signIn } from "@ogcio/sag-client"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useRef, useState } from "react"
import { ANALYTICS } from "@/const/analytics"
import { env } from "@/env/env.client"
import { useOrganizationId } from "@/hooks/profile-admin/use-organization-id"
import {
  getProfileImportErrorDetail,
  getProfileImportIdFromResponse,
  type ProfileImportApiResponse,
} from "@/util/profile-admin/profile-import-response"
import { url as buildUrl } from "@/util/profile-admin/url"
import { ZONE_SAG_APP_NAME } from "@/util/zone"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

function DownloadCSVTemplate() {
  const t = useTranslations("serviceUsers.import")
  const analyticsClient = useAnalytics()
  const organizationId = useOrganizationId()
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = async () => {
    analyticsClient.trackEvent({
      event: {
        name: ANALYTICS.recipient.sampleCsvDownload.name,
        category: ANALYTICS.recipient.category,
        action: ANALYTICS.recipient.sampleCsvDownload.action,
      },
    })
    setIsDownloading(true)
    try {
      const headers: Record<string, string> = {
        "X-Application": ZONE_SAG_APP_NAME["profile-admin"],
      }
      if (organizationId) headers["X-Organization-Id"] = organizationId

      const response = await fetch(
        `${env.NEXT_PUBLIC_SAG_URL}/profile/api/v1/profiles/imports/template`,
        {
          credentials: "include",
          headers,
        },
      )

      if (response.status === 401) {
        signIn(env.NEXT_PUBLIC_SAG_URL, ZONE_SAG_APP_NAME["profile-admin"])
        return
      }

      if (!response.ok) {
        throw new Error(t("download.error"))
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = objectUrl
      anchor.download = "service-users-template.csv"
      anchor.style.display = "none"
      document.body.appendChild(anchor)
      anchor.click()
      setTimeout(() => {
        URL.revokeObjectURL(objectUrl)
        anchor.remove()
      }, 100)
    } catch {
      toaster.create({
        title: t("download.error"),
        position: { x: "right", y: "top" },
        variant: "danger",
      })
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Stack direction='column' gap={4}>
      <Heading as='h3'>{t("download.title")}</Heading>
      <Paragraph>{t("download.description")}</Paragraph>
      <div>
        <Button
          variant='secondary'
          onClick={handleDownload}
          disabled={isDownloading}
        >
          {isDownloading ? t("download.loading") : t("download.action")}
          {isDownloading && <Spinner />}
        </Button>
      </div>
    </Stack>
  )
}

function UploadCSVFile() {
  const t = useTranslations("serviceUsers.import")
  const router = useRouter()
  const locale = useLocale()
  const url = buildUrl(locale)
  const analyticsClient = useAnalytics()
  const organizationId = useOrganizationId()

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_SIZE) {
      setFileError(t("upload.errors.fileSize"))
      e.target.value = ""
      setSelectedFile(null)
      return
    }
    setFileError(null)
    setSelectedFile(file)
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) return

    analyticsClient.trackEvent({
      event: {
        name: ANALYTICS.recipient.sampleCsvUpload.name,
        category: ANALYTICS.recipient.category,
        action: ANALYTICS.recipient.sampleCsvUpload.action,
      },
    })

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", selectedFile)

      const headers: Record<string, string> = {
        "X-Application": ZONE_SAG_APP_NAME["profile-admin"],
      }
      if (organizationId) headers["X-Organization-Id"] = organizationId

      const response = await fetch(
        `${env.NEXT_PUBLIC_SAG_URL}/profile/api/v1/profiles/imports`,
        {
          method: "POST",
          credentials: "include",
          headers,
          body: formData,
        },
      )

      const json = (await response
        .json()
        .catch(() => ({}))) as ProfileImportApiResponse
      const profileImportId = getProfileImportIdFromResponse(json)

      if (!response.ok || json.error || !profileImportId) {
        const detail = getProfileImportErrorDetail(json, t("upload.error"))
        setFileError(detail)
        toaster.create({
          title: t("upload.error"),
          position: { x: "right", y: "top" },
          variant: "danger",
        })
        analyticsClient.trackEvent({
          event: {
            name: ANALYTICS.recipient.csvUploadFail.name,
            category: ANALYTICS.recipient.category,
            action: ANALYTICS.recipient.csvUploadFail.action,
          },
        })
        return
      }

      setFileError(null)
      setSelectedFile(null)
      if (inputRef.current) inputRef.current.value = ""
      toaster.create({
        title: t("upload.success"),
        position: { x: "right", y: "top" },
        variant: "success",
      })
      analyticsClient.trackEvent({
        event: {
          name: ANALYTICS.recipient.csvUploadSuccess.name,
          category: ANALYTICS.recipient.category,
          action: ANALYTICS.recipient.csvUploadSuccess.action,
        },
      })
      router.push(url.serviceUsers.imports(profileImportId))
    } catch (err) {
      const message = err instanceof Error ? err.message : t("upload.error")
      setFileError(message)
      toaster.create({
        title: t("upload.error"),
        position: { x: "right", y: "top" },
        variant: "danger",
      })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <form onSubmit={handleUpload}>
      <Stack direction='column' gap={4}>
        <Heading as='h3'>{t("upload.title")}</Heading>
        <Paragraph>{t("upload.description")}</Paragraph>
        <input
          ref={inputRef}
          className='gi-file-upload-input'
          type='file'
          aria-invalid='false'
          aria-label={t("upload.label")}
          accept='.csv'
          name='file'
          disabled={isUploading}
          onChange={handleFileChange}
        />
        <div>
          <Button
            type='submit'
            variant='secondary'
            disabled={!selectedFile || isUploading}
          >
            {isUploading ? t("upload.loading") : t("upload.action")}
            {isUploading && <Spinner />}
          </Button>
        </div>
        {fileError && <FormField error={{ text: fileError }} />}
      </Stack>
    </form>
  )
}

export function ServiceUsersImportCSV() {
  return (
    <Stack direction='column' gap={10} hasDivider>
      <DownloadCSVTemplate />
      <UploadCSVFile />
    </Stack>
  )
}
