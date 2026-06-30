import { useGatewayFetch } from "@ogcio/sag-client/react"
import { useMemo } from "react"
import { getMockUnreadCount, MOCK_MESSAGES_ENABLED } from "@/mock/messages"
import type { Message } from "@/types"

/**
 * Unread count for the inbox folder badge. Uses the messages API total
 * when available; falls back to mock fixtures in local dev.
 */
export function useInboxUnreadCount(): number {
  const { data: apiMessages = [], metadata } = useGatewayFetch<
    Message[],
    { totalCount?: number }
  >("/messaging/api/v1/messages?limit=1&offset=0&isSeen=false")

  return useMemo(() => {
    const mockCount = getMockUnreadCount()

    if (metadata?.totalCount != null && metadata.totalCount > 0) {
      return metadata.totalCount
    }

    if (apiMessages.length > 0) {
      const apiUnread = apiMessages.filter((message) => !message.isSeen).length
      if (apiUnread > 0) return apiUnread
    }

    if (MOCK_MESSAGES_ENABLED && mockCount > 0) {
      return mockCount
    }

    return metadata?.totalCount ?? 0
  }, [apiMessages, metadata?.totalCount])
}
