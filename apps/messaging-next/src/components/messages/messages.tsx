"use client"

import {
  Card,
  CardContainer,
  CardHeader,
  CardSubtitle,
  CardTitle,
  Heading,
  Paragraph,
  Spinner,
  Stack,
  TabItem,
  TabList,
  TabPanel,
  Tabs,
} from "@ogcio/design-system-react"
import {
  useGatewayDownload,
  useGatewayFetch,
  useGatewayMutation,
} from "@ogcio/sag-client/react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { BackButton } from "@/components/button/back-button"
import { DownloadIcon } from "@/components/icons"
import type { FileMetadata, Message } from "@/types"
import { MessageTable } from "./message-table"
import { buildMessagesUrl, computeTotalPages } from "./pagination-utils"
import { PaginationWrapper } from "./pagination-wrapper"
import { parseTab } from "./parse-tab"
import { SearchBar } from "./search-bar"
import { SecureEmailViewer } from "./secure-email-viewer"

export function MessagesPage() {
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

  return <MessageListView onSelect={selectMessage} />
}

function MessageListView({ onSelect }: { onSelect: (id: string) => void }) {
  const t = useTranslations("home")
  const searchParams = useSearchParams()
  const router = useRouter()
  const tab = parseTab(searchParams.get("tab"))
  const search = searchParams.get("search")
  const page = Number(searchParams.get("page")) || 1

  const apiUrl = useMemo(
    () => buildMessagesUrl({ tab, search, page }),
    [tab, search, page],
  )

  const {
    data: messages = [],
    metadata,
    isLoading,
  } = useGatewayFetch<Message[], { totalCount?: number }>(apiUrl)

  const [previousHeight, setPreviousHeight] = useState(0)
  useEffect(() => {
    if (isLoading) {
      const el = document.querySelector("#table-body")
      if (el) setPreviousHeight(el.getBoundingClientRect().height)
    }
  }, [isLoading])

  const totalPages = computeTotalPages(metadata?.totalCount ?? 0)

  const switchTab = (value: "unread" | "all") => {
    const params = new URLSearchParams(searchParams)
    params.set("tab", value)
    params.delete("page")
    router.push(`?${params.toString()}`)
  }

  const tabContent = (
    <>
      <MessageTable
        messages={messages}
        isLoading={isLoading}
        previousHeight={previousHeight}
        onSelect={onSelect}
      />
      <PaginationWrapper totalPages={totalPages} />
    </>
  )

  return (
    <div className='twelve-column-layout'>
      <Stack direction='column' gap={10} className='two-thirds-col-span'>
        <Heading id='messages-heading'>{t("heading")}</Heading>
        <SearchBar />
        <Tabs ariaLabelledBy='messages-heading' id='message-tabs'>
          <TabList tabName='message-tabs'>
            <TabItem
              value='unread'
              checked={tab === "unread"}
              aria-label={t("ariaLabel.unread")}
              onTabClick={() => switchTab("unread")}
            >
              {t("tab.unread")}
            </TabItem>
            <TabItem
              value='all'
              checked={tab === "all"}
              aria-label={t("ariaLabel.all")}
              onTabClick={() => switchTab("all")}
            >
              {t("tab.all")}
            </TabItem>
          </TabList>
          <TabPanel value='unread'>{tab === "unread" && tabContent}</TabPanel>
          <TabPanel value='all'>{tab === "all" && tabContent}</TabPanel>
        </Tabs>
      </Stack>
    </div>
  )
}

function MessageDetailView({ id }: { id: string }) {
  const hasMarkedRead = useRef(false)

  const { data, error, isLoading } = useGatewayFetch<Message>(
    `/messaging/api/v1/messages/${id}`,
  )

  const { trigger: markAsSeen } = useGatewayMutation(
    `/messaging/api/v1/message-actions/${id}`,
    { method: "PUT" },
  )

  useEffect(() => {
    if (data && !hasMarkedRead.current) {
      hasMarkedRead.current = true
      markAsSeen({ messageId: id, isSeen: true }).catch(() => {})
    }
  }, [data, markAsSeen, id])

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
  const { download, isDownloading } = useGatewayDownload({
    openInNewTab: true,
  })

  if (!data) return null

  const sizeKb = Math.round(data.fileSize / 1024)

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!isDownloading) {
      download(`/upload/api/v1/files/${id}`, data.fileName).catch(() => {})
    }
  }

  return (
    <Card type='horizontal'>
      <div className='gi-card-icon'>
        <DownloadIcon size='xl' className='gi-text-gray-500' />
      </div>
      <CardContainer>
        <CardHeader>
          <CardTitle>
            <button
              data-testid='attachment-download-action'
              type='button'
              onClick={handleOpen}
              aria-busy={isDownloading}
              disabled={isDownloading}
              className='gi-link'
            >
              {data.fileName}
            </button>
          </CardTitle>
          <CardSubtitle>{`${sizeKb} kb`}</CardSubtitle>
        </CardHeader>
      </CardContainer>
    </Card>
  )
}
