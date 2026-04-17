"use client"

import { Heading, Paragraph, Spinner, Stack } from "@ogcio/design-system-react"
import {
  useGatewayDownload,
  useGatewayFetch,
  useGatewayMutation,
} from "@ogcio/sag-client/react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { BackButton } from "@/components/button/back-button"
import mockMessages from "@/mock/messages.json"
import type { FileMetadata, Message } from "@/types"
import { SecureEmailViewer } from "./secure-email-viewer"
import { UnifiedInboxTable } from "./unified-inbox-table"

const DEFAULT_PAGE_SIZE = 6

function buildMessagesUrl(params: {
  search: string | null
  page: number
  pageSize: number
  status?: string
}) {
  const url = new URLSearchParams()
  url.set("limit", String(params.pageSize))
  url.set("offset", String((params.page - 1) * params.pageSize))

  if (params.status === "unread") {
    url.set("isSeen", "false")
  } else if (params.status === "read") {
    url.set("isSeen", "true")
  }

  if (params.search) {
    url.set("search", params.search)
  }
  return `/messaging/api/v1/messages?${url.toString()}`
}

export function UnifiedInboxPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selectedId = searchParams.get("id")

  const selectMessage = useCallback(
    (id: string) => {
      router.push(`${pathname}?id=${id}`, { scroll: false })
    },
    [router, pathname],
  )

  if (selectedId) {
    return <MessageDetailView id={selectedId} />
  }

  return <UnifiedInboxListView onSelect={selectMessage} />
}

function UnifiedInboxListView({
  onSelect,
}: {
  onSelect: (id: string) => void
}) {
  const t = useTranslations("home")
  const searchParams = useSearchParams()
  const search = searchParams.get("search")
  const status = searchParams.get("status") || "all"
  const page = Number(searchParams.get("page")) || 1
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const apiUrl = useMemo(
    () => buildMessagesUrl({ search, page, pageSize, status }),
    [search, page, pageSize, status],
  )

  const {
    data: apiMessages = [],
    metadata,
    isLoading,
  } = useGatewayFetch<Message[], { totalCount?: number }>(apiUrl)

  const messages = useMemo(() => {
    if (apiMessages.length > 0) return apiMessages
    const mocks = mockMessages as Message[]
    if (!search) return mocks.slice((page - 1) * pageSize, page * pageSize)
    const lower = search.toLowerCase()
    const filtered = mocks.filter(
      (m) =>
        m.subject.toLowerCase().includes(lower) ||
        (m.threadName ?? "").toLowerCase().includes(lower),
    )
    return filtered.slice((page - 1) * pageSize, page * pageSize)
  }, [apiMessages, search, page, pageSize])

  const totalCount = useMemo(() => {
    if (metadata?.totalCount) return metadata.totalCount
    const mocks = mockMessages as Message[]
    if (!search) return mocks.length
    const lower = search.toLowerCase()
    return mocks.filter(
      (m) =>
        m.subject.toLowerCase().includes(lower) ||
        (m.threadName ?? "").toLowerCase().includes(lower),
    ).length
  }, [metadata?.totalCount, search])

  return (
    <Stack direction='column' gap={10}>
      <Heading id='messages-heading'>{t("heading")}</Heading>
      <UnifiedInboxTable
        messages={messages}
        isLoading={isLoading}
        totalCount={totalCount}
        onSelect={onSelect}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
      />
    </Stack>
  )
}

function MessageDetailView({ id }: { id: string }) {
  const hasMarkedRead = useRef(false)

  const {
    data: apiData,
    error,
    isLoading,
  } = useGatewayFetch<Message>(`/messaging/api/v1/messages/${id}`)

  const data = useMemo(() => {
    if (apiData) return apiData
    return (mockMessages as Message[]).find((m) => m.id === id) ?? null
  }, [apiData, id])

  const { trigger: markAsSeen } = useGatewayMutation(
    `/messaging/api/v1/message-actions/${id}`,
    { method: "PUT" },
  )

  useEffect(() => {
    if (data && !hasMarkedRead.current) {
      hasMarkedRead.current = true
      markAsSeen({ messageId: id, isSeen: true }).catch(() => {})
    }
  }, [data, id, markAsSeen])

  if (isLoading) {
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

  if (error || !data) {
    return (
      <Stack direction='column' gap={10}>
        <Paragraph>{error?.message ?? "Message not found"}</Paragraph>
        <BackButton />
      </Stack>
    )
  }

  const richText = data.richText || undefined
  const plainText = data.plainText || undefined
  const attachments = data.attachments ?? []

  return (
    <Stack direction='column' gap={10}>
      <Heading>{data.subject}</Heading>
      {richText ? (
        <SecureEmailViewer content={richText} />
      ) : (
        <Paragraph whitespace='pre-wrap' size='md'>
          {plainText}
        </Paragraph>
      )}

      {attachments.length > 0 && <AttachmentList attachmentIds={attachments} />}

      <BackButton />
    </Stack>
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

function AttachmentCard({ id }: { id: string }) {
  const { data } = useGatewayFetch<FileMetadata>(
    `/upload/api/v1/metadata/${id}`,
  )
  const { download, isDownloading } = useGatewayDownload()

  if (!data) return null

  const sizeKb = Math.round(data.fileSize / 1024)

  const handleDownload = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault()
    if (!isDownloading) {
      download(`/upload/api/v1/files/${id}`, data.fileName).catch(() => {})
    }
  }

  return (
    <button
      type='button'
      onClick={handleDownload}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          handleDownload(e)
        }
      }}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "12px",
        border: "1px solid var(--gi-color-gray-300)",
        borderRadius: "4px",
        cursor: "pointer",
        backgroundColor: isDownloading
          ? "var(--gi-color-gray-100)"
          : "transparent",
        width: "100%",
        textAlign: "left",
        font: "inherit",
      }}
      aria-label={`Download ${data.fileName} (${sizeKb} KB)`}
      disabled={isDownloading}
    >
      <span style={{ marginRight: "8px", fontSize: "18px" }}>📎</span>
      <div>
        <div style={{ fontWeight: "bold" }}>{data.fileName}</div>
        <div
          style={{ fontSize: "0.875rem", color: "var(--gi-color-gray-600)" }}
        >
          {sizeKb} KB
        </div>
      </div>
    </button>
  )
}
