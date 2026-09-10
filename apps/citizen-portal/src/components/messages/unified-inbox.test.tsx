import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const trackEvent = vi.hoisted(() => vi.fn())
const mockPush = vi.hoisted(() => vi.fn())

vi.mock("@ogcio/nextjs-analytics", () => ({
  useAnalytics: () => ({ trackEvent }),
}))

let currentSearchParams = new URLSearchParams()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
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

// Render the sidebar slot too: the folders flag (AB#42582) decides whether
// `UnifiedInboxPage` passes one, so swallowing it would hide the gating.
vi.mock("@/components/messages/inbox-layout", () => ({
  InboxLayout: ({
    sidebar,
    children,
  }: {
    sidebar?: React.ReactNode
    children: React.ReactNode
  }) => (
    <div>
      {sidebar}
      {children}
    </div>
  ),
}))

vi.mock("@/components/messages/message-folders-sidebar", () => ({
  INBOX_FOLDER_ID: "inbox",
  DELETED_FOLDER_ID: "deleted",
  MessageFoldersSidebar: () => <nav data-testid='folders-sidebar' />,
}))

vi.mock("@/components/messages/message-detail-view", () => ({
  MessageDetailView: () => null,
}))

// Surface the folder-gated props so the specs can assert on them without
// pulling in the real (heavy) table.
vi.mock("@/components/messages/unified-inbox-table", () => ({
  UnifiedInboxTable: ({
    canMove,
    onOpenFolders,
    onSelect,
  }: {
    canMove?: boolean
    onOpenFolders?: () => void
    onSelect: (id: string) => void
  }) => (
    <div
      data-testid='inbox-table'
      data-can-move={String(Boolean(canMove))}
      data-can-open-folders={String(Boolean(onOpenFolders))}
    >
      <button type='button' onClick={() => onSelect("msg-1")}>
        Open message
      </button>
    </div>
  ),
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
  MobileFolderPanel: () => <div data-testid='mobile-folder-panel' />,
}))

vi.mock("@/components/messages/move-message-modal", () => ({
  MoveMessageModal: () => <div data-testid='move-message-modal' />,
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

// Folders are a build-time flag (AB#42582). `destinations` also has to be
// non-empty for `canMove`, so both are driven per spec.
const flagState = vi.hoisted(() => ({
  folders: true,
  destinations: [{ id: "folder-1", label: "EHIC" }] as Array<{
    id: string
    label: string
  }>,
}))

vi.mock("@/lib/feature-config", () => ({
  isFoldersEnabled: () => flagState.folders,
}))

vi.mock("@/components/messages/use-message-folders", () => ({
  useMessageFolders: () => flagState.destinations,
}))

import { UnifiedInboxPage } from "@/components/messages/unified-inbox"

describe("UnifiedInboxPage analytics", () => {
  beforeEach(() => {
    trackEvent.mockClear()
    mockPush.mockClear()
    currentSearchParams = new URLSearchParams()
    flagState.folders = true
    flagState.destinations = [{ id: "folder-1", label: "EHIC" }]
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

describe("UnifiedInboxPage folders flag (AB#42582)", () => {
  beforeEach(() => {
    trackEvent.mockClear()
    currentSearchParams = new URLSearchParams()
    flagState.folders = true
    flagState.destinations = [{ id: "folder-1", label: "EHIC" }]
  })

  it("ships the folder surfaces when the flag is on", () => {
    render(<UnifiedInboxPage />)

    expect(screen.getByTestId("folders-sidebar")).toBeInTheDocument()
    expect(screen.getByTestId("mobile-folder-panel")).toBeInTheDocument()
    expect(screen.getByTestId("move-message-modal")).toBeInTheDocument()

    const table = screen.getByTestId("inbox-table")
    expect(table).toHaveAttribute("data-can-move", "true")
    expect(table).toHaveAttribute("data-can-open-folders", "true")
  })

  it("drops every folder surface when the flag is off", () => {
    flagState.folders = false

    render(<UnifiedInboxPage />)

    expect(screen.queryByTestId("folders-sidebar")).not.toBeInTheDocument()
    expect(screen.queryByTestId("mobile-folder-panel")).not.toBeInTheDocument()
    expect(screen.queryByTestId("move-message-modal")).not.toBeInTheDocument()

    const table = screen.getByTestId("inbox-table")
    expect(table).toHaveAttribute("data-can-move", "false")
    expect(table).toHaveAttribute("data-can-open-folders", "false")
  })

  it("keeps Move hidden in the Deleted view even with the flag on", () => {
    currentSearchParams = new URLSearchParams({ folder: "deleted" })

    render(<UnifiedInboxPage />)

    expect(screen.getByTestId("inbox-table")).toHaveAttribute(
      "data-can-move",
      "false",
    )
  })

  it("preserves the current folder when opening a message", () => {
    currentSearchParams = new URLSearchParams({ folder: "folder-1" })
    render(<UnifiedInboxPage />)

    screen.getByRole("button", { name: "Open message" }).click()

    expect(mockPush).toHaveBeenCalledWith(
      "/en/messages?folder=folder-1&id=msg-1",
      { scroll: false },
    )
  })

  it("hides Move when the flag is on but no destination folders exist", () => {
    flagState.destinations = []

    render(<UnifiedInboxPage />)

    expect(screen.getByTestId("inbox-table")).toHaveAttribute(
      "data-can-move",
      "false",
    )
  })

  it("omits the sidebar on the detail route when the flag is off", () => {
    currentSearchParams = new URLSearchParams({ id: "msg-1" })
    flagState.folders = false

    render(<UnifiedInboxPage />)

    expect(screen.queryByTestId("folders-sidebar")).not.toBeInTheDocument()
  })

  it("keeps the sidebar on the detail route when the flag is on", () => {
    currentSearchParams = new URLSearchParams({ id: "msg-1" })

    render(<UnifiedInboxPage />)

    expect(screen.getByTestId("folders-sidebar")).toBeInTheDocument()
  })
})
