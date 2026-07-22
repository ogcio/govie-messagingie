"use client"

import { Button, Stack } from "@ogcio/design-system-react"
import { useGatewayFetch } from "@ogcio/sag-client/react"
import { usePathname, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useUrlSearchParams } from "@/hooks/use-url-search-params"
import { getMockMessagesTotalCount } from "@/mock/messages"
import type { Message } from "@/types"
import { BulkActionToolbar } from "./bulk-action-toolbar"
import { DeleteConfirmationModal } from "./delete-confirmation-modal"
import { DeleteResultToast } from "./delete-result-toast"
import { InboxLayout } from "./inbox-layout"
import { InboxListChromeHeader } from "./inbox-list-chrome-header"
import { DELETE_FLASH_KEY, MOVE_FLASH_KEY } from "./message-action-flash-keys"
import { MessageDetailView } from "./message-detail-view"
import {
  DELETED_FOLDER_ID,
  INBOX_FOLDER_ID,
  MessageFoldersSidebar,
} from "./message-folders-sidebar"
import { MobileFolderPanel } from "./mobile-folder-panel"
import { MoveMessageModal } from "./move-message-modal"
import { MoveResultToast } from "./move-result-toast"
import { DEFAULT_PAGE_SIZE, parsePageSize } from "./page-size"
import {
  hasActiveInboxListFilters,
  resolveInboxMessages,
} from "./resolve-inbox-messages"
import styles from "./unified-inbox.module.css"
import { UnifiedInboxTable } from "./unified-inbox-table"
import tableStyles from "./unified-inbox-table.module.css"
import {
  type DeleteMessagesResult,
  useDeleteMessages,
} from "./use-delete-messages"
import { useMessageFolders } from "./use-message-folders"
import { useMessageSelection } from "./use-message-selection"
import { type MoveMessagesResult, useMoveMessages } from "./use-move-messages"

function buildMessagesUrl(params: {
  search: string | null
  page: number
  pageSize: number
  status?: string
  /** Active folder: `null`/`inbox` = untagged, `deleted` = trash, else a tag id. */
  folderId?: string | null
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

  // Folder scoping: Inbox shows only untagged messages, a user folder filters
  // by its tag id, and Deleted is handled by its own soft-delete view (not a
  // tag) so it is intentionally left untouched here.
  if (!params.folderId || params.folderId === INBOX_FOLDER_ID) {
    url.set("untagged", "true")
  } else if (params.folderId !== DELETED_FOLDER_ID) {
    url.set("tagId", params.folderId)
  }

  return `/messaging/api/v1/messages?${url.toString()}`
}

export function UnifiedInboxPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useUrlSearchParams()
  const selectedId = searchParams.get("id")

  const selectMessage = useCallback(
    (id: string) => {
      router.push(`${pathname}?id=${id}`, { scroll: false })
    },
    [router, pathname],
  )

  if (selectedId) {
    return (
      <InboxLayout sidebar={<MessageFoldersSidebar />}>
        <MessageDetailView id={selectedId} />
      </InboxLayout>
    )
  }

  return (
    <InboxLayout sidebar={<MessageFoldersSidebar />}>
      <UnifiedInboxListView onSelect={selectMessage} />
    </InboxLayout>
  )
}

function UnifiedInboxListView({
  onSelect,
}: {
  onSelect: (id: string) => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useUrlSearchParams()
  const tMove = useTranslations("home.move")
  const search = searchParams.get("search")
  const status = searchParams.get("status") || "all"
  const page = Number(searchParams.get("page")) || 1
  const pageSize = parsePageSize(searchParams.get("limit"))
  const folderId = searchParams.get("folder")
  const isInboxView = !folderId || folderId === INBOX_FOLDER_ID
  const isDeletedView = folderId === DELETED_FOLDER_ID

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
    () => buildMessagesUrl({ search, page, pageSize, status, folderId }),
    [search, page, pageSize, status, folderId],
  )

  const {
    data: apiMessages = [],
    metadata,
    isLoading,
    refresh,
  } = useGatewayFetch<Message[], { totalCount?: number }>(apiUrl)

  const hasActiveListFilters = hasActiveInboxListFilters({ search, status })

  const previousMessagesRef = useRef<Message[]>([])

  const messages = useMemo(() => {
    const resolved = resolveInboxMessages({
      apiMessages,
      isLoading,
      isInboxView,
      search,
      status,
      page,
      pageSize,
    })

    if (!isLoading) {
      previousMessagesRef.current = resolved
      return resolved
    }

    if (resolved.length > 0) {
      previousMessagesRef.current = resolved
      return resolved
    }

    if (previousMessagesRef.current.length > 0) {
      return previousMessagesRef.current
    }

    return resolved
  }, [apiMessages, isLoading, isInboxView, search, status, page, pageSize])

  const totalCount = useMemo(() => {
    if (metadata?.totalCount != null) return metadata.totalCount
    if (apiMessages.length > 0) return apiMessages.length
    if (!isLoading && hasActiveListFilters) return 0
    if (!isInboxView) return 0
    return getMockMessagesTotalCount(search, status === "all" ? null : status)
  }, [
    metadata?.totalCount,
    apiMessages.length,
    isLoading,
    hasActiveListFilters,
    search,
    status,
    isInboxView,
  ])

  const selection = useMessageSelection(messages)
  const {
    deleteIds,
    isLoading: isDeleting,
    lastResult: deleteLastResult,
    dismissResult: dismissDeleteResult,
  } = useDeleteMessages({ onSettled: () => refresh() })
  const {
    moveIds,
    isLoading: isMoving,
    lastResult: moveLastResult,
    dismissResult: dismissMoveResult,
  } = useMoveMessages({ onSettled: () => refresh() })

  // Destinations exclude the current folder; the Deleted view is never a move
  // source, so Move is hidden there regardless of available folders.
  const currentFolderId = isInboxView ? null : folderId
  const destinations = useMessageFolders({
    currentFolderId,
    inboxLabel: tMove("modal.inbox"),
  })
  const canMove = !isDeletedView && destinations.length > 0

  const [deleteFlashResult, setDeleteFlashResult] =
    useState<DeleteMessagesResult | null>(null)
  const [moveFlashResult, setMoveFlashResult] =
    useState<MoveMessagesResult | null>(null)
  const [pendingIds, setPendingIds] = useState<string[] | null>(null)
  const [isMoveModalOpen, setMoveModalOpen] = useState(false)
  const [isFolderPanelOpen, setFolderPanelOpen] = useState(false)
  const [selectMode, setSelectMode] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    const deleteRaw = window.sessionStorage.getItem(DELETE_FLASH_KEY)
    if (deleteRaw) {
      try {
        setDeleteFlashResult(JSON.parse(deleteRaw) as DeleteMessagesResult)
      } catch {
        // Ignore malformed values silently.
      } finally {
        window.sessionStorage.removeItem(DELETE_FLASH_KEY)
      }
    }

    const moveRaw = window.sessionStorage.getItem(MOVE_FLASH_KEY)
    if (moveRaw) {
      try {
        setMoveFlashResult(JSON.parse(moveRaw) as MoveMessagesResult)
      } catch {
        // Ignore malformed values silently.
      } finally {
        window.sessionStorage.removeItem(MOVE_FLASH_KEY)
      }
    }
  }, [])

  const activeDeleteResult = deleteLastResult ?? deleteFlashResult
  const activeMoveResult = moveLastResult ?? moveFlashResult

  const handleDismissDeleteResult = useCallback(() => {
    setDeleteFlashResult(null)
    dismissDeleteResult()
  }, [dismissDeleteResult])

  const handleDismissMoveResult = useCallback(() => {
    setMoveFlashResult(null)
    dismissMoveResult()
  }, [dismissMoveResult])

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

  const handleMove = useCallback(
    async (destFolderId: string | null) => {
      setMoveModalOpen(false)
      const ids = Array.from(selection.selectedIds)
      if (ids.length === 0) return
      const result = await moveIds(ids, destFolderId)
      if (result.ok) {
        selection.clear()
        setSelectMode(false)
      }
    },
    [moveIds, selection],
  )

  const bulkActionBar = useMemo(
    () =>
      selection.selectedCount > 0 ? (
        <BulkActionToolbar
          selectedCount={selection.selectedCount}
          onDelete={() =>
            openDeleteConfirmation(Array.from(selection.selectedIds))
          }
          onClearSelection={() => {
            selection.clear()
            setSelectMode(false)
          }}
          extraActions={
            canMove ? (
              <Button
                data-testid='bulk-move-button'
                variant='secondary'
                appearance='light'
                size='small'
                onClick={() => setMoveModalOpen(true)}
              >
                {tMove("moveTo")}
              </Button>
            ) : null
          }
        />
      ) : null,
    [
      selection.selectedCount,
      selection.selectedIds,
      openDeleteConfirmation,
      canMove,
      tMove,
    ],
  )

  return (
    <div className={styles.listRoot}>
      <Stack
        direction='column'
        gap={6}
        itemsAlignment='stretch'
        className={styles.inboxStack}
      >
        <DeleteResultToast
          result={activeDeleteResult}
          onDismiss={handleDismissDeleteResult}
        />
        <MoveResultToast
          result={activeMoveResult}
          onDismiss={handleDismissMoveResult}
        />
        <div className={styles.mobileFullBleed}>
          <div className={tableStyles.listChrome}>
            <InboxListChromeHeader
              showToolbar={selection.selectedCount > 0}
              bulkActionBar={bulkActionBar}
            />
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
              onBulkDelete={() =>
                openDeleteConfirmation(Array.from(selection.selectedIds))
              }
              onOpenFolders={() => setFolderPanelOpen(true)}
              onBulkMove={() => setMoveModalOpen(true)}
              canMove={canMove}
            />
          </div>
        </div>
        <DeleteConfirmationModal
          isOpen={pendingIds !== null}
          count={pendingIds?.length ?? 0}
          onClose={() => setPendingIds(null)}
          onConfirm={confirmDelete}
          isDeleting={isDeleting}
        />
        <MoveMessageModal
          isOpen={isMoveModalOpen}
          onClose={() => setMoveModalOpen(false)}
          onConfirm={handleMove}
          destinations={destinations}
          isMoving={isMoving}
        />
        <MobileFolderPanel
          isOpen={isFolderPanelOpen}
          onClose={() => setFolderPanelOpen(false)}
        />
      </Stack>
    </div>
  )
}
