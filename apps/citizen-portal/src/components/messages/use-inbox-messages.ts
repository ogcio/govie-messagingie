"use client"

import { useGatewayFetch } from "@ogcio/sag-client/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getMockMessagesTotalCount } from "@/mock/messages"
import type { Message } from "@/types"
import { DELETED_FOLDER_ID, INBOX_FOLDER_ID } from "./message-folders-sidebar"
import {
  hasActiveInboxListFilters,
  resolveInboxMessages,
} from "./resolve-inbox-messages"

export function buildMessagesUrl(params: {
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

export interface UseInboxMessagesParams {
  /** When true the list accumulates pages (mobile infinite scroll). */
  isMobile: boolean
  search: string | null
  status: string
  folderId: string | null
  /** Desktop page taken from the `?page=` URL param. Ignored on mobile. */
  page: number
  pageSize: number
}

export interface UseInboxMessagesResult {
  messages: Message[]
  totalCount: number
  /** Initial load: no rows to show yet. Drives the full-list spinner. */
  isLoading: boolean
  /** A subsequent page is loading while earlier rows are already shown. */
  isLoadingMore: boolean
  /** Mobile only: more pages remain to be appended. */
  hasMore: boolean
  /** Mobile only: append the next page. */
  loadMore: () => void
  refresh: () => void
}

/**
 * Inbox list data source that serves two modes from one place:
 *
 *  - Desktop (`isMobile === false`): classic paging. The visible page tracks
 *    the `?page=` URL param exactly as before — one page in, one page out.
 *  - Mobile (`isMobile === true`): infinite scroll. Pages are fetched one at a
 *    time via an internal cursor and appended into an accumulated list. The
 *    accumulation resets to page 1 whenever the query identity (search term,
 *    folder, status, or page size) changes so a new search always starts from
 *    the top.
 *
 * Both modes fetch a single page URL through the same SWR-backed
 * `useGatewayFetch`, so switching viewport reuses the cached page-1 response
 * (identical key) rather than issuing a duplicate request.
 */
export function useInboxMessages(
  params: UseInboxMessagesParams,
): UseInboxMessagesResult {
  const { isMobile, search, status, folderId, page, pageSize } = params
  const isInboxView = !folderId || folderId === INBOX_FOLDER_ID

  const [mobilePage, setMobilePage] = useState(1)
  const [accumulated, setAccumulated] = useState<Message[]>([])
  // Rows keyed by their (1-based) page number so re-renders rebuild the list
  // deterministically and a page is never appended twice.
  const loadedPagesRef = useRef<Map<number, Message[]>>(new Map())
  const pendingRefreshRef = useRef(false)

  // Query identity excluding the paging cursor. A change restarts the mobile
  // accumulation from page 1. Resetting during render (rather than in an
  // effect) keeps the very next fetch aligned with the new query and avoids a
  // frame that appends fresh rows onto stale ones.
  const queryKey = `${search ?? ""}|${status}|${folderId ?? ""}|${pageSize}`
  const prevQueryKeyRef = useRef(queryKey)
  const queryChanged = prevQueryKeyRef.current !== queryKey
  if (queryChanged) {
    prevQueryKeyRef.current = queryKey
    loadedPagesRef.current = new Map()
    setAccumulated([])
    if (mobilePage !== 1) setMobilePage(1)
  }

  const activePage = isMobile ? mobilePage : page
  const apiUrl = useMemo(
    () =>
      buildMessagesUrl({
        search,
        page: activePage,
        pageSize,
        status,
        folderId,
      }),
    [search, activePage, pageSize, status, folderId],
  )

  const {
    data: apiMessages = [],
    metadata,
    isLoading,
    refresh: swrRefresh,
  } = useGatewayFetch<Message[], { totalCount?: number }>(apiUrl)

  const resolvedPage = useMemo(
    () =>
      resolveInboxMessages({
        apiMessages,
        isLoading,
        isInboxView,
        search,
        status,
        page: activePage,
        pageSize,
      }),
    [apiMessages, isLoading, isInboxView, search, status, activePage, pageSize],
  )

  const hasActiveListFilters = hasActiveInboxListFilters({ search, status })
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

  // Accumulate the settled page into the ordered mobile list. Runs after the
  // fetch resolves so page rows land in order; desktop skips it entirely.
  useEffect(() => {
    if (!isMobile) return
    if (isLoading) return
    if (queryChanged) return

    const pages = loadedPagesRef.current
    pages.set(mobilePage, resolvedPage)

    const ordered: Message[] = []
    for (let p = 1; p <= mobilePage; p++) {
      const rows = pages.get(p)
      if (rows) ordered.push(...rows)
    }
    setAccumulated(ordered)
  }, [isMobile, isLoading, queryChanged, resolvedPage, mobilePage])

  // After a mutation (delete / move) on mobile we restart from page 1 so the
  // list reflects the server state; this effect revalidates page 1 once the
  // cursor has been reset to it.
  useEffect(() => {
    if (!pendingRefreshRef.current) return
    if (mobilePage !== 1) return
    pendingRefreshRef.current = false
    void swrRefresh()
  }, [mobilePage, swrRefresh])

  // Desktop keeps showing the previous page while the next one loads to avoid
  // a blank flash on page change (mobile relies on the accumulated list).
  const previousDesktopRef = useRef<Message[]>([])
  const desktopMessages = useMemo(() => {
    if (!isLoading || resolvedPage.length > 0) {
      previousDesktopRef.current = resolvedPage
      return resolvedPage
    }
    if (previousDesktopRef.current.length > 0) {
      return previousDesktopRef.current
    }
    return resolvedPage
  }, [isLoading, resolvedPage])

  const messages = isMobile ? accumulated : desktopMessages

  const loadMore = useCallback(() => {
    // Only advance once the current top page has landed, so a burst of
    // intersection callbacks cannot skip a page or double-fetch.
    setMobilePage((current) =>
      loadedPagesRef.current.has(current) ? current + 1 : current,
    )
  }, [])

  const refresh = useCallback(() => {
    if (!isMobile) {
      void swrRefresh()
      return
    }
    loadedPagesRef.current = new Map()
    setAccumulated([])
    if (mobilePage === 1) {
      void swrRefresh()
      return
    }
    pendingRefreshRef.current = true
    setMobilePage(1)
  }, [isMobile, mobilePage, swrRefresh])

  const isLoadingMore = isMobile && isLoading && accumulated.length > 0
  const isInitialLoading = isMobile
    ? (isLoading || totalCount > 0) && accumulated.length === 0
    : isLoading
  const hasMore = isMobile && messages.length < totalCount

  return {
    messages,
    totalCount,
    isLoading: isInitialLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    refresh,
  }
}
