import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { InboxUnreadBadge } from "@/components/messages/inbox-unread-badge"

vi.mock("@/components/messages/use-inbox-unread-count", () => ({
  useInboxUnreadCount: vi.fn(),
}))

import { useInboxUnreadCount } from "@/components/messages/use-inbox-unread-count"

const mockUseInboxUnreadCount = vi.mocked(useInboxUnreadCount)

vi.mock("@ogcio/design-system-react", () => ({
  Spinner: () => <span data-testid='unread-badge-spinner'>Loading</span>,
}))

describe("InboxUnreadBadge", () => {
  it("shows a spinner while the unread count is loading", () => {
    mockUseInboxUnreadCount.mockReturnValue({ count: 0, isLoading: true })

    render(<InboxUnreadBadge />)

    expect(screen.getByTestId("unread-badge-spinner")).toBeInTheDocument()
    expect(screen.queryByText("3")).not.toBeInTheDocument()
  })

  it("shows the unread count once loading completes", () => {
    mockUseInboxUnreadCount.mockReturnValue({ count: 3, isLoading: false })

    render(<InboxUnreadBadge />)

    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.queryByTestId("unread-badge-spinner")).not.toBeInTheDocument()
  })

  it("renders nothing when there are no unread messages", () => {
    mockUseInboxUnreadCount.mockReturnValue({ count: 0, isLoading: false })

    const { container } = render(<InboxUnreadBadge />)

    expect(container).toBeEmptyDOMElement()
  })
})
