"use client"

import {
  Button,
  Heading,
  Paragraph,
  Spinner,
  Stack,
} from "@ogcio/design-system-react"
import { useGatewayFetch } from "@ogcio/sag-client/react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useState } from "react"
import { BackButton } from "@/components/button/back-button"
import {
  findMockMessageById,
  getMockMessagesPage,
  getMockMessagesTotalCount,
} from "@/mock/messages"
import type { Message } from "@/types"
import { AttachmentCard } from "./attachment-card"
import { BulkActionToolbar } from "./bulk-action-toolbar"
import { DeleteConfirmationModal } from "./delete-confirmation-modal"
import { DeleteResultToast } from "./delete-result-toast"
import { SecureEmailViewer } from "./secure-email-viewer"
import styles from "./unified-inbox.module.css"
import { UnifiedInboxTable } from "./unified-inbox-table"
import {
  type DeleteMessagesResult,
  useDeleteMessages,
} from "./use-delete-messages"
import { useMarkMessageAsRead } from "./use-mark-message-as-read"
import { DEFAULT_PAGE_SIZE, parsePageSize } from "./page-size"
import { useMessageSelection } from "./use-message-selection"

/**
 * Keys the list view reads on mount so the detail-view can surface a success
 * banner after redirecting on delete. Stored in sessionStorage so the flash is
 * scoped to the browser session and never leaks across tabs.
 */
const DELETE_FLASH_KEY = "messaging-next.delete-flash"

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
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams.get("search")
  const status = searchParams.get("status") || "all"
  const page = Number(searchParams.get("page")) || 1
  const pageSize = parsePageSize(searchParams.get("limit"))

  const handlePageSizeChange = useCallback(
    (size: number) => {
      const params = new URLSearchParams(searchParams)
      if (size === DEFAULT_PAGE_SIZE) {
        params.delete("limit")
      } else {
        params.set("limit", String(size))
      }
      params.delete("page")
      const qs = params.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname)
    },
    [router, pathname, searchParams],
  )

  const apiUrl = useMemo(
    () => buildMessagesUrl({ search, page, pageSize, status }),
    [search, page, pageSize, status],
  )

  const {
    data: apiMessages = [],
    metadata,
    isLoading,
    refresh,
  } = useGatewayFetch<Message[], { totalCount?: number }>(apiUrl)

  /*
   * API is the source of truth. When it returns an empty list or omits
   * `metadata.totalCount`, fall back to bundled fixtures only when
   * `NEXT_PUBLIC_ENABLE_MOCK_MESSAGES=true` (dev-only flag, off by default).
   * In every deployed environment the fallback collapses to an empty list.
   */
  const messages = useMemo(() => {
    if (isLoading && apiMessages.length === 0) return []
    if (apiMessages.length > 0) return apiMessages
    return getMockMessagesPage({ search, page, pageSize })
  }, [apiMessages, isLoading, search, page, pageSize])

  const totalCount = useMemo(() => {
    if (metadata?.totalCount) return metadata.totalCount
    return getMockMessagesTotalCount(search)
  }, [metadata?.totalCount, search])

  const selection = useMessageSelection(messages)
  const {
    deleteIds,
    isLoading: isDeleting,
    lastResult,
    dismissResult,
  } = useDeleteMessages({ onSettled: () => refresh() })

  const [flashResult, setFlashResult] = useState<DeleteMessagesResult | null>(
    null,
  )
  const [pendingIds, setPendingIds] = useState<string[] | null>(null)
  const [selectMode, setSelectMode] = useState(false)

  // Read and clear the flash result written by the detail view after a delete.
  useEffect(() => {
    if (typeof window === "undefined") return
    const raw = window.sessionStorage.getItem(DELETE_FLASH_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as DeleteMessagesResult
      setFlashResult(parsed)
    } catch {
      // Ignore malformed values silently.
    } finally {
      window.sessionStorage.removeItem(DELETE_FLASH_KEY)
    }
  }, [])

  const activeResult = lastResult ?? flashResult

  const handleDismissResult = useCallback(() => {
    setFlashResult(null)
    dismissResult()
  }, [dismissResult])

  const openDeleteConfirmation = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    setPendingIds(ids)
  }, [])

  const confirmDelete = useCallback(async () => {
    if (!pendingIds) return
    const ids = pendingIds
    setPendingIds(null)
    const result = await deleteIds(ids)
    if (result.ok) {
      selection.clear()
      setSelectMode(false)
    }
  }, [pendingIds, deleteIds, selection])

  /*
   * Bulk-action banner is rendered inline by the table (not a standalone
   * full-bleed block above it anymore): on mobile it replaces the search
   * row, on desktop it replaces the unread-count row below the search. See
   * UnifiedInboxTable's `bulkActionBar` slot + its CSS for the per-viewport
   * wiring. Kept as a local memo so the same node identity is threaded on
   * every render while selection count is unchanged.
   */
  const bulkActionBar = useMemo(
    () =>
      selection.selectedCount > 0 ? (
        <BulkActionToolbar
          selectedCount={selection.selectedCount}
          onDelete={() =>
            openDeleteConfirmation(Array.from(selection.selectedIds))
          }
        />
      ) : null,
    [selection.selectedCount, selection.selectedIds, openDeleteConfirmation],
  )

  return (
    /*
     * Thin wrapper so the mobile-only `.mobileFullBleed` child has a stable
     * positioning context. The list deliberately inherits its parent DS
     * `<Container>` width on desktop so it stays aligned with the
     * `PageHeader` (same Container, same max-width, same gutters). See
     * unified-inbox.module.css for the reasoning.
     */
    <div className={styles.listRoot}>
      {/*
       * `itemsAlignment='stretch'` is load-bearing: DS `Stack` defaults to
       * `items-start`, which on a column flex lays children out left-aligned
       * at their intrinsic content width instead of stretching them across
       * the cross-axis. That went unnoticed while the parent `<Container>`
       * still capped the list at 768/1024px, but once the container moved to
       * `fullWidth` the Stack's children stayed pinned at the table's
       * column-sum width (~720px) and the search bar / selected-count banner
       * stopped lining up with the PageHeader above. `stretch` makes the
       * wrapping divs fill the list row so the whole column matches the
       * header crest on desktop and tablet.
       */}
      <Stack direction='column' gap={6} itemsAlignment='stretch'>
        {/*
         * Result feedback is delivered through the DS Toast portal
         * (mounted once in ClientShell) rather than an inline banner.
         * This component renders nothing; it just dispatches a toast on
         * each new `activeResult` and clears the ambient state.
         */}
        <DeleteResultToast
          result={activeResult}
          onDismiss={handleDismissResult}
        />
        {/*
         * Mobile-only full-bleed so the list (including the inline
         * bulk-action banner it owns) spans edge-to-edge on small screens.
         * Desktop inherits the listRoot width, so the table already scales
         * with the viewport and the banner sits inside the container column
         * — directly below the search bar.
         */}
        <div className={styles.mobileFullBleed}>
          <UnifiedInboxTable
            messages={messages}
            isLoading={isLoading}
            totalCount={totalCount}
            onSelect={onSelect}
            pageSize={pageSize}
            onPageSizeChange={handlePageSizeChange}
            selection={selection}
            selectMode={selectMode}
            onEnterSelectMode={() => setSelectMode(true)}
            onExitSelectMode={() => setSelectMode(false)}
            bulkActionBar={bulkActionBar}
            onBulkDelete={() =>
              openDeleteConfirmation(Array.from(selection.selectedIds))
            }
          />
        </div>
        <DeleteConfirmationModal
          isOpen={pendingIds !== null}
          count={pendingIds?.length ?? 0}
          onClose={() => setPendingIds(null)}
          onConfirm={confirmDelete}
          isDeleting={isDeleting}
        />
      </Stack>
    </div>
  )
}

function MessageDetailView({ id }: { id: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations("home.detail")

  const {
    data: apiData,
    error,
    isLoading,
  } = useGatewayFetch<Message>(`/messaging/api/v1/messages/${id}`)

  const data = useMemo(() => {
    if (apiData) return apiData
    return findMockMessageById(id)
  }, [apiData, id])

  useMarkMessageAsRead(id, Boolean(data))

  const { deleteIds, isLoading: isDeleting } = useDeleteMessages()
  const [isConfirmOpen, setConfirmOpen] = useState(false)

  const handleDelete = useCallback(async () => {
    setConfirmOpen(false)
    const result = await deleteIds([id])
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(DELETE_FLASH_KEY, JSON.stringify(result))
    }
    const listPath = pathname.split("?")[0]
    router.push(listPath)
  }, [deleteIds, id, pathname, router])

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

      <Stack direction='row' gap={4}>
        <BackButton />
        <Button
          data-testid='detail-delete-button'
          variant='secondary'
          appearance='default'
          onClick={() => setConfirmOpen(true)}
          disabled={isDeleting}
        >
          {t("delete")}
        </Button>
      </Stack>

      <DeleteConfirmationModal
        isOpen={isConfirmOpen}
        count={1}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
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
