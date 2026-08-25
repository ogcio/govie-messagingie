import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const trackEvent = vi.hoisted(() => vi.fn())

vi.mock("@ogcio/nextjs-analytics", () => ({
  useAnalytics: () => ({ trackEvent }),
}))

let currentSearchParams = new URLSearchParams()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/en/messages",
  useSearchParams: () => currentSearchParams,
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock("@ogcio/sag-client/react", () => ({
  useGatewayFetch: () => ({
    data: [],
    metadata: { totalCount: 0 },
    isLoading: false,
    refresh: vi.fn(),
  }),
}))

vi.mock("@/mock/messages", () => ({
  MOCK_MESSAGES_ENABLED: false,
  getMockMessagesPage: () => [],
  getMockMessagesTotalCount: () => 0,
  findMockMessageById: () => null,
}))

vi.mock("@/components/messages/inbox-layout", () => ({
  InboxLayout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

vi.mock("@/components/messages/message-folders-sidebar", () => ({
  INBOX_FOLDER_ID: "inbox",
  DELETED_FOLDER_ID: "deleted",
  MessageFoldersSidebar: () => null,
}))

vi.mock("@/components/messages/message-detail-view", () => ({
  MessageDetailView: () => null,
}))

vi.mock("@/components/messages/unified-inbox-table", () => ({
  UnifiedInboxTable: () => null,
}))

vi.mock("@/components/messages/bulk-action-toolbar", () => ({
  BulkActionToolbar: () => null,
}))

vi.mock("@/components/messages/delete-confirmation-modal", () => ({
  DeleteConfirmationModal: () => null,
}))

vi.mock("@/components/messages/delete-result-toast", () => ({
  DeleteResultToast: () => null,
}))

vi.mock("@/components/messages/mobile-folder-panel", () => ({
  MobileFolderPanel: () => null,
}))

vi.mock("@/components/messages/move-message-modal", () => ({
  MoveMessageModal: () => null,
}))

vi.mock("@/components/messages/move-result-toast", () => ({
  MoveResultToast: () => null,
}))

vi.mock("@/components/messages/use-delete-messages", () => ({
  useDeleteMessages: () => ({
    deleteIds: vi.fn(),
    isLoading: false,
    lastResult: null,
    dismissResult: vi.fn(),
  }),
}))

vi.mock("@/components/messages/use-move-messages", () => ({
  useMoveMessages: () => ({
    moveIds: vi.fn(),
    isLoading: false,
    lastResult: null,
    dismissResult: vi.fn(),
  }),
}))

vi.mock("@/components/messages/use-message-folders", () => ({
  useMessageFolders: () => [],
}))

import { UnifiedInboxPage } from "@/components/messages/unified-inbox"

describe("UnifiedInboxPage analytics", () => {
  beforeEach(() => {
    trackEvent.mockClear()
    currentSearchParams = new URLSearchParams()
  })

  it("fires message-list-view on mount", () => {
    render(<UnifiedInboxPage />)

    expect(trackEvent).toHaveBeenCalledWith({
      event: {
        name: "message-list-view",
        category: "Message",
        action: "Message List Viewed",
      },
    })
  })

  it("fires message-list-view only once across re-renders", () => {
    const { rerender } = render(<UnifiedInboxPage />)
    rerender(<UnifiedInboxPage />)

    const listViewCalls = trackEvent.mock.calls.filter(
      ([arg]) => arg.event.name === "message-list-view",
    )
    expect(listViewCalls).toHaveLength(1)
  })
})
