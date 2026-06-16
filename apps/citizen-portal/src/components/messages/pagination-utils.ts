import type { Tab } from "./parse-tab"

export const PAGE_SIZE = 10

export function buildMessagesUrl(params: {
  tab: Tab | string
  search: string | null
  page: number
}) {
  const url = new URLSearchParams()
  url.set("limit", String(PAGE_SIZE))
  url.set("offset", String((params.page - 1) * PAGE_SIZE))
  if (params.tab === "unread") {
    url.set("isSeen", "false")
  }
  if (params.search) {
    url.set("search", params.search)
  }
  return `/messaging/api/v1/messages?${url.toString()}`
}

export function computeTotalPages(totalCount: number): number {
  return Math.ceil(totalCount / PAGE_SIZE)
}
