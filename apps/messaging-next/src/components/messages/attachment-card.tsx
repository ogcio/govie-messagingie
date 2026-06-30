"use client"

import {
  Button,
  Card,
  CardContainer,
  CardHeader,
  CardSubtitle,
  CardTitle,
  Icon,
  Spinner,
  Stack,
} from "@ogcio/design-system-react"
import { useGatewayDownload, useGatewayFetch } from "@ogcio/sag-client/react"
import { useTranslations } from "next-intl"
import type { FileMetadata } from "@/types"

export function AttachmentCard({ id }: { id: string }) {
  const t = useTranslations("home.detail.attachment")
  const { data } = useGatewayFetch<FileMetadata>(
    `/upload/api/v1/metadata/${id}`,
  )
  const { download: openPreview, isDownloading: isOpening } = useGatewayDownload(
    {
      openInNewTab: true,
    },
  )
  const { download: saveFile, isDownloading: isSaving } = useGatewayDownload({
    openInNewTab: false,
  })

  if (!data) return null

  const sizeKb = Math.round(data.fileSize / 1024)
  const filePath = `/upload/api/v1/files/${id}`
  const isBusy = isOpening || isSaving

  const handlePreview = () => {
    if (!isBusy) {
      openPreview(filePath, data.fileName).catch(() => {})
    }
  }

  const handleDownload = () => {
    if (!isBusy) {
      saveFile(filePath, data.fileName).catch(() => {})
    }
  }

  return (
    <Card type='vertical'>
      <CardContainer>
        <CardHeader>
          <CardTitle>
            <Stack direction='row' gap={2} itemsAlignment='center'>
              <Icon
                icon='download'
                size='lg'
                className='gi-text-gray-500'
                ariaHidden
              />
              <span>{data.fileName}</span>
            </Stack>
          </CardTitle>
          <CardSubtitle>{`${sizeKb} kb`}</CardSubtitle>
          <Stack direction='row' gap={3} itemsAlignment='center' wrap>
            <Button
              data-testid='attachment-preview-action'
              type='button'
              variant='secondary'
              onClick={handlePreview}
              aria-busy={isOpening}
              disabled={isBusy}
              aria-label={t("previewFile", { fileName: data.fileName })}
            >
              {isOpening ? <Spinner size='sm' /> : t("preview")}
            </Button>
            <Button
              data-testid='attachment-download-action'
              type='button'
              variant='secondary'
              onClick={handleDownload}
              aria-busy={isSaving}
              disabled={isBusy}
              aria-label={t("downloadFile", { fileName: data.fileName })}
            >
              {isSaving ? <Spinner size='sm' /> : t("download")}
            </Button>
          </Stack>
        </CardHeader>
      </CardContainer>
    </Card>
  )
}
