import { useGatewayFetch } from "@ogcio/sag-client/react"
import { useMemo } from "react"
import { getMockUnreadCount, MOCK_MESSAGES_ENABLED } from "@/mock/messages"

export interface InboxUnreadCountState {
  count: number
  isLoading: boolean
}

/**
 * Unread count for the inbox folder badge. Uses the messages API
 * `metadata.totalCount` when available; falls back to mock fixtures in
 * local dev. While the total is still loading we expose `isLoading` so
 * consumers can show a spinner instead of a partial count from the
 * `limit=1` probe request.
 */
export function useInboxUnreadCount(): InboxUnreadCountState {
  const { metadata, isLoading } = useGatewayFetch<
    unknown[],
    { totalCount?: number }
  >("/messaging/api/v1/messages?limit=1&offset=0&isSeen=false&untagged=true")

  return useMemo(() => {
    if (metadata?.totalCount != null) {
      return { count: metadata.totalCount, isLoading: false }
    }

    if (isLoading) {
      return { count: 0, isLoading: true }
    }

    const mockCount = getMockUnreadCount()
    if (MOCK_MESSAGES_ENABLED && mockCount > 0) {
      return { count: mockCount, isLoading: false }
    }

    return { count: 0, isLoading: false }
  }, [isLoading, metadata?.totalCount])
}
