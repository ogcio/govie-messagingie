"use client"

import { useCrossZoneLink } from "@citizen-portal/shared"
import { Icon, Link, Paragraph, Stack } from "@ogcio/design-system-react"
import { useAuth, useGatewayFetch } from "@ogcio/sag-client/react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useCallback, useMemo, useState } from "react"
import { BackButton } from "@/components/button/back-button"
import { CssSpinner } from "@/components/css-spinner"
import { pickLocalized } from "@/components/submissions/localized"
import { getMockAttachmentIds } from "@/mock/attachments"
import { findMockMessageById } from "@/mock/messages"
import { findMockSubmissionIdForRelatedMessage } from "@/mock/related-messages"
import { findMockSubmissionById } from "@/mock/submissions"
import type { Message } from "@/types"
import { AttachmentCard } from "./attachment-card"
import { DeleteConfirmationModal } from "./delete-confirmation-modal"
import { DELETE_FLASH_KEY, MOVE_FLASH_KEY } from "./message-action-flash-keys"
import styles from "./message-detail.module.css"
import { MessageDetailBody } from "./message-detail-body"
import { MessageDetailHeader } from "./message-detail-header"
import { MessageDetailToolbar } from "./message-detail-toolbar"
import { MoveMessageModal } from "./move-message-modal"
import { useDeleteMessages } from "./use-delete-messages"
import { useMarkMessageAsRead } from "./use-mark-message-as-read"
import { useMessageFolders } from "./use-message-folders"
import { useMoveMessages } from "./use-move-messages"

export interface MessageDetailViewProps {
  id: string
}

function buildMessageMetadataUrl(messageId: string): string {
  const params = new URLSearchParams({ includeMetadata: "true" })
  return `/messaging-public-api/api/v1/citizens/messages/${messageId}?${params.toString()}`
}

export function MessageDetailView({ id }: MessageDetailViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const locale = useLocale()
  const crossZone = useCrossZoneLink()
  const tMove = useTranslations("home.move.modal")
  const tDetail = useTranslations("home.detail")
  useAuth()
  const submissionIdFromUrl = searchParams.get("submissionId")

  const {
    data: apiData,
    error,
    isLoading,
  } = useGatewayFetch<Message>(`/messaging/api/v1/messages/${id}`)

  const { data: metadataMessage } = useGatewayFetch<Message>(
    submissionIdFromUrl ? null : buildMessageMetadataUrl(id),
  )

  const data = useMemo(() => {
    if (apiData) return apiData
    return findMockMessageById(id)
  }, [apiData, id])

  const submissionId = useMemo(() => {
    if (submissionIdFromUrl) return submissionIdFromUrl
    if (metadataMessage?.metadata?.journey?.submissionId) {
      return metadataMessage.metadata.journey.submissionId
    }
    return findMockSubmissionIdForRelatedMessage(id)
  }, [
    metadataMessage?.metadata?.journey?.submissionId,
    submissionIdFromUrl,
    id,
  ])

  const submissionTitleFromUrl = searchParams.get("submissionTitle")

  const applicationLink = useMemo(() => {
    if (!submissionId) return null
    const mockSubmission = findMockSubmissionById(submissionId)
    const title =
      submissionTitleFromUrl ??
      (mockSubmission ? pickLocalized(mockSubmission.title, locale) : undefined)
    const href = crossZone(
      "dashboard",
      `/${locale}/my-applications?id=${encodeURIComponent(submissionId)}`,
    )
    return { href, title }
  }, [crossZone, locale, submissionId, submissionTitleFromUrl])

  const attachments = useMemo(
    () => (data ? getMockAttachmentIds(data) : []),
    [data],
  )

  useMarkMessageAsRead(id, Boolean(data))

  const { deleteIds, isLoading: isDeleting } = useDeleteMessages()
  const { moveIds, isLoading: isMoving } = useMoveMessages()

  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [isMoveModalOpen, setMoveModalOpen] = useState(false)

  // All messages are inbox until the Folders epic exposes tagId on messages.
  const currentFolderId: string | null = null
  const destinations = useMessageFolders({
    currentFolderId,
    inboxLabel: tMove("inbox"),
  })

  const listPath = pathname.split("?")[0]
  const backHref = listPath

  const handleDelete = useCallback(async () => {
    setDeleteConfirmOpen(false)
    const result = await deleteIds([id])
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(DELETE_FLASH_KEY, JSON.stringify(result))
    }
    router.push(listPath)
  }, [deleteIds, id, listPath, router])

  const handleMove = useCallback(
    async (folderId: string | null) => {
      setMoveModalOpen(false)
      const result = await moveIds([id], folderId)
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(MOVE_FLASH_KEY, JSON.stringify(result))
      }
      router.push(listPath)
    },
    [id, listPath, moveIds, router],
  )

  if (isLoading) {
    return (
      <output
        aria-label='Loading'
        className='gi-flex gi-items-center gi-justify-center'
        style={{ minHeight: "30vh" }}
      >
        <CssSpinner size='xl' />
      </output>
    )
  }

  if (!data) {
    return (
      <div className={styles.detailRoot}>
        <Paragraph>{error?.message ?? "Message not found"}</Paragraph>
        <BackButton />
      </div>
    )
  }

  const richText = data.richText || undefined
  const plainText = data.plainText || undefined

  return (
    <div className={styles.detailRoot}>
      <MessageDetailToolbar
        backHref={backHref}
        onMove={() => setMoveModalOpen(true)}
        onDelete={() => setDeleteConfirmOpen(true)}
        isDeleting={isDeleting}
        isMoving={isMoving}
      />

      <div className={`${styles.detailContent} o11y-replay-block`}>
        <MessageDetailHeader
          subject={data.subject}
          organisationId={data.organisationId}
          createdAt={data.createdAt}
        />

        <MessageDetailBody
          richText={richText}
          plainText={plainText}
          attachmentCount={attachments.length}
        />

        {attachments.length > 0 && (
          <AttachmentList attachmentIds={attachments} />
        )}

        {applicationLink ? (
          <div className={styles.applicationLink}>
            <Link
              href={applicationLink.href}
              noColor
              className={styles.toolbarAction}
              aria-label={
                applicationLink.title
                  ? tDetail("backToApplicationNamed", {
                      title: applicationLink.title,
                    })
                  : tDetail("backToApplication")
              }
            >
              <Icon
                icon='chevron_left'
                size='md'
                className={styles.toolbarIcon}
                ariaHidden
              />
              {applicationLink.title
                ? tDetail("backToApplicationNamed", {
                    title: applicationLink.title,
                  })
                : tDetail("backToApplication")}
            </Link>
          </div>
        ) : null}
      </div>

      <DeleteConfirmationModal
        isOpen={isDeleteConfirmOpen}
        count={1}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />

      <MoveMessageModal
        isOpen={isMoveModalOpen}
        onClose={() => setMoveModalOpen(false)}
        onConfirm={handleMove}
        destinations={destinations}
        isMoving={isMoving}
      />
    </div>
  )
}

function AttachmentList({ attachmentIds }: { attachmentIds: string[] }) {
  return (
    <Stack direction='column' gap={2}>
      {attachmentIds.map((attachmentId) => (
        <AttachmentCard key={attachmentId} id={attachmentId} />
      ))}
    </Stack>
  )
}
