import { getMockMessagesPage, MOCK_MESSAGES_ENABLED } from "@/mock/messages"
import type { Message } from "@/types"

export function hasActiveInboxListFilters(args: {
  search: string | null
  status: string
}): boolean {
  return (
    Boolean(args.search?.trim()) ||
    args.status === "unread" ||
    args.status === "read"
  )
}

export function resolveInboxMessages(args: {
  apiMessages: Message[]
  isLoading: boolean
  isInboxView: boolean
  search: string | null
  status: string
  page: number
  pageSize: number
}): Message[] {
  const {
    apiMessages,
    isLoading,
    isInboxView,
    search,
    status,
    page,
    pageSize,
  } = args

  if (isLoading && apiMessages.length === 0) return []
  if (apiMessages.length > 0) return apiMessages
  if (!isInboxView) return []

  // API settled with no rows: use fixtures only when mocks are enabled.
  // Fixtures honour the same search/status filters as the real API path.
  if (!isLoading && MOCK_MESSAGES_ENABLED) {
    return getMockMessagesPage({
      search,
      page,
      pageSize,
      status: status === "all" ? null : status,
    })
  }

  return apiMessages
}
