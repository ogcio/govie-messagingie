import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { UnifiedInboxTable } from "@/components/messages/unified-inbox-table"
import type { Message } from "@/types"

const mockPush = vi.fn()
let currentSearchParams = new URLSearchParams()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => currentSearchParams,
}))

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, params?: { [k: string]: string | number }) => {
    const translations: Record<string, string> = {
      "home.table.aria.messageList": "Message list",
      "home.table.column.sender": "Sender",
      "home.table.column.status": "Status",
      "home.table.column.date": "Date",
      "home.table.column.details": "Details",
      "home.table.column.attachment": "Attachment",
      "home.table.loading": "Loading messages...",
      "home.table.rowsPerPage": "Rows per page",
      "home.table.from": "From",
      "home.table.unknownSender": "Unknown sender",
      "home.table.empty.all": "You have no messages",
      "home.table.empty.search": `No messages found for "${params?.query ?? ""}"`,
      "search.input.placeholder": "Search",
      "search.button.search": "Search",
    }

    const value = translations[`${namespace}.${key}`]
    if (key === "attachment") {
      return (Number(params?.count) || 0) === 1 ? "attachment" : "attachments"
    }
    if (key === "unreadCount") {
      const count = Number(params?.count) || 0
      return `(${count}) unread message${count === 1 ? "" : "s"}`
    }
    return value ?? key
  },
}))

const baseMessage: Message = {
  id: "msg-1",
  subject: "Your annual statement is available",
  createdAt: "2025-01-15T10:30:00Z",
  threadName: "Department of Social Protection",
  organisationId: "org-1",
  recipientUserId: "user-1",
  excerpt: "Please review your updated annual statement in the portal.",
  isSeen: false,
  attachmentsCount: 1,
}

const messages: Message[] = [
  baseMessage,
  {
    ...baseMessage,
    id: "msg-2",
    subject: "Payment confirmation",
    isSeen: true,
    attachmentsCount: 0,
  },
]

const defaultProps = {
  messages,
  isLoading: false,
  onSelect: vi.fn(),
  pageSize: 10,
  onPageSizeChange: vi.fn(),
}

describe("UnifiedInboxTable", () => {
  beforeEach(() => {
    currentSearchParams = new URLSearchParams()
    mockPush.mockClear()
  })

  it("renders search input and table", () => {
    render(<UnifiedInboxTable {...defaultProps} />)

    expect(screen.getByTestId("search-input")).toBeInTheDocument()
    expect(screen.getByTestId("unified-inbox-table")).toBeInTheDocument()
    expect(screen.getByRole("table", { name: "Message list" })).toBeInTheDocument()
  })

  it("selects a message when mobile row button is clicked", () => {
    const onSelect = vi.fn()
    render(<UnifiedInboxTable {...defaultProps} onSelect={onSelect} />)

    fireEvent.click(
      screen.getByRole("button", {
        name: /Unread message from Department of Social Protection: Your annual statement is available/i,
      }),
    )
    expect(onSelect).toHaveBeenCalledWith("msg-1")
  })

  it("shows all messages regardless of read state", () => {
    render(<UnifiedInboxTable {...defaultProps} />)

    expect(screen.getAllByText("Your annual statement is available").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Payment confirmation").length).toBeGreaterThan(0)
  })

  it("shows unread count when there are unread messages", () => {
    render(<UnifiedInboxTable {...defaultProps} />)

    expect(screen.getByText("(1) unread message")).toBeInTheDocument()
  })

  it("pushes search query on Enter key", () => {
    render(<UnifiedInboxTable {...defaultProps} />)

    const input = screen.getByTestId("search-input")
    fireEvent.change(input, { target: { value: "statement" } })
    fireEvent.keyDown(input, { key: "Enter" })

    expect(mockPush).toHaveBeenCalledWith("?search=statement")
  })

  it("pushes search query on search button click", () => {
    render(<UnifiedInboxTable {...defaultProps} />)

    fireEvent.change(screen.getByTestId("search-input"), { target: { value: "statement" } })
    fireEvent.click(screen.getByRole("button", { name: "Search" }))

    expect(mockPush).toHaveBeenCalledWith("?search=statement")
  })

  it("clears search query when input is emptied and search is triggered", () => {
    currentSearchParams = new URLSearchParams("search=old&page=2")
    render(<UnifiedInboxTable {...defaultProps} />)

    const input = screen.getByTestId("search-input")
    fireEvent.change(input, { target: { value: "" } })
    fireEvent.keyDown(input, { key: "Enter" })

    expect(mockPush).toHaveBeenCalledWith("?")
  })

  it("shows loading state", () => {
    render(<UnifiedInboxTable {...defaultProps} messages={[]} isLoading />)

    expect(screen.getByText("Loading messages...")).toBeInTheDocument()
  })

  it("shows attachment icon with aria-label in desktop table", () => {
    render(<UnifiedInboxTable {...defaultProps} />)

    expect(screen.getByLabelText("1 attachment")).toBeInTheDocument()
  })

  it("shows empty state when no messages", () => {
    render(<UnifiedInboxTable {...defaultProps} messages={[]} />)

    expect(screen.getByText("You have no messages")).toBeInTheDocument()
  })
})
