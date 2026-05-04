import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { UnifiedInboxTable } from "@/components/messages/unified-inbox-table"
import { useMessageSelection } from "@/components/messages/use-message-selection"
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
  useTranslations:
    (namespace: string) =>
    (key: string, params?: { [k: string]: string | number }) => {
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
        "home.table.select": "Select",
        "home.table.selectAll": "Select All",
        "home.table.close": "Close",
        "home.table.ariaLabel.selectAll": "Select all messages on this page",
        "search.input.placeholder": "Search",
        "search.button.search": "Search",
      }

      const value = translations[`${namespace}.${key}`]
      if (key === "attachment") {
        return (Number(params?.count) || 0) === 1 ? "attachment" : "attachments"
      }
      if (key === "unreadCount") {
        const count = Number(params?.count) || 0
        return `${count} unread`
      }
      if (key === "selectedCount") {
        const count = Number(params?.count) || 0
        return `${count} selected`
      }
      if (namespace === "home.delete.toolbar" && key === "delete") {
        return "Delete"
      }
      if (namespace === "home.table" && key === "ariaLabel.selectRow") {
        return `Select message from ${params?.sender}: ${params?.subject}`
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

// Wrapper that wires a real useMessageSelection hook into the table so
// interaction tests can drive the checkbox / select-all columns. Per-row
// deletion is intentionally omitted: the bulk toolbar covers single-message
// deletion via the row checkbox.
function TableWithSelection(props: {
  selectMode?: boolean
  onEnterSelectMode?: () => void
  onExitSelectMode?: () => void
}) {
  const selection = useMessageSelection(messages)
  return (
    <UnifiedInboxTable
      {...defaultProps}
      selection={selection}
      selectMode={props.selectMode}
      onEnterSelectMode={props.onEnterSelectMode}
      onExitSelectMode={props.onExitSelectMode}
    />
  )
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
    expect(
      screen.getByRole("table", { name: "Message list" }),
    ).toBeInTheDocument()
  })

  it("shows all messages regardless of read state", () => {
    render(<UnifiedInboxTable {...defaultProps} />)

    expect(
      screen.getAllByText("Your annual statement is available").length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText("Payment confirmation").length,
    ).toBeGreaterThan(0)
  })

  it("shows unread count when there are unread messages", () => {
    render(<UnifiedInboxTable {...defaultProps} />)

    expect(screen.getAllByText("1 unread").length).toBeGreaterThan(0)
  })

  it("pushes search query on Enter key", () => {
    render(<UnifiedInboxTable {...defaultProps} />)

    const input = screen.getByTestId("search-input")
    fireEvent.change(input, { target: { value: "statement" } })
    fireEvent.keyDown(input, { key: "Enter" })

    expect(mockPush).toHaveBeenCalledWith("?search=statement")
  })

  it("shows loading state", () => {
    render(<UnifiedInboxTable {...defaultProps} messages={[]} isLoading />)

    expect(screen.getByText("Loading messages...")).toBeInTheDocument()
  })

  it("shows empty state when no messages", () => {
    render(<UnifiedInboxTable {...defaultProps} messages={[]} />)

    expect(screen.getByText("You have no messages")).toBeInTheDocument()
  })

  it("does not render a per-row delete control (deletion goes through the bulk toolbar)", () => {
    render(<TableWithSelection />)

    expect(screen.queryByTestId("delete-row-msg-1")).not.toBeInTheDocument()
    expect(screen.queryByTestId("delete-row-msg-2")).not.toBeInTheDocument()
  })

  it("checkbox selection shows the right checked state", () => {
    render(<TableWithSelection />)

    const rowCheckbox = screen.getByTestId("select-row-msg-1") as HTMLInputElement
    expect(rowCheckbox.checked).toBe(false)
    fireEvent.click(rowCheckbox)
    expect(rowCheckbox.checked).toBe(true)
  })

  it("select-all toggles every visible row", () => {
    render(<TableWithSelection />)

    const selectAll = screen.getByTestId("select-all-checkbox") as HTMLInputElement
    fireEvent.click(selectAll)

    expect(
      (screen.getByTestId("select-row-msg-1") as HTMLInputElement).checked,
    ).toBe(true)
    expect(
      (screen.getByTestId("select-row-msg-2") as HTMLInputElement).checked,
    ).toBe(true)
  })

  it("select-all is indeterminate when some — but not all — rows are selected", () => {
    render(<TableWithSelection />)

    const selectAll = screen.getByTestId(
      "select-all-checkbox",
    ) as HTMLInputElement
    expect(selectAll.checked).toBe(false)
    expect(selectAll.indeterminate).toBe(false)

    fireEvent.click(screen.getByTestId("select-row-msg-1"))

    // Partial selection: semantically mixed, visually a dash (not a tick).
    expect(selectAll.checked).toBe(false)
    expect(selectAll.indeterminate).toBe(true)
    expect(selectAll.getAttribute("aria-checked")).toBe("mixed")

    // Selecting the remaining row flips it to fully checked.
    fireEvent.click(screen.getByTestId("select-row-msg-2"))
    expect(selectAll.checked).toBe(true)
    expect(selectAll.indeterminate).toBe(false)
  })

  it("mobile select-all header appears when rows are selected even if the explicit mobile select mode is off", () => {
    // Simulates the cross-viewport case: the user selects rows via the
    // desktop checkboxes (which are always visible on desktop) and then
    // resizes down to a mobile viewport without ever tapping the mobile
    // "Select" button. The bulk banner + mobile select header must reflect
    // the non-empty selection instead of the default "(N) unread" header.
    render(<TableWithSelection />)

    expect(screen.getByTestId("mobile-select-button")).toBeInTheDocument()
    expect(
      screen.queryByTestId("mobile-select-all-checkbox"),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId("select-row-msg-1"))

    expect(screen.getByTestId("mobile-select-all-checkbox")).toBeInTheDocument()
    expect(screen.getByTestId("mobile-select-close")).toBeInTheDocument()
    expect(
      screen.queryByTestId("mobile-select-button"),
    ).not.toBeInTheDocument()
  })

  it("mobile Select button calls onEnterSelectMode", () => {
    const onEnterSelectMode = vi.fn()
    render(<TableWithSelection onEnterSelectMode={onEnterSelectMode} />)

    fireEvent.click(screen.getByTestId("mobile-select-button"))
    expect(onEnterSelectMode).toHaveBeenCalledTimes(1)
  })

  it("mobile Close button exits select mode and clears selection", () => {
    const onExitSelectMode = vi.fn()
    render(
      <TableWithSelection
        selectMode
        onExitSelectMode={onExitSelectMode}
      />,
    )

    fireEvent.click(screen.getByTestId("mobile-select-close"))
    expect(onExitSelectMode).toHaveBeenCalledTimes(1)
  })

  it("renders the bulkActionBar slot exactly once and suppresses the desktop unread-count row", () => {
    // The slot has to be a single node so Playwright strict-mode queries
    // like `getByTestId('bulk-delete-button')` don't see duplicates across
    // mobile/desktop render paths. It also has to replace — not stack with
    // — the `(N) unread` desktop line when the user has a selection, so
    // the two never appear together in the same render: with this test
    // fixture the unread text should appear exactly once (in the mobile
    // select-header, which is display:none on desktop but stays in the
    // DOM), and the desktop block is skipped entirely.
    render(
      <UnifiedInboxTable
        {...defaultProps}
        bulkActionBar={<div data-testid='bulk-action-bar-slot'>banner</div>}
      />,
    )

    expect(screen.getAllByTestId("bulk-action-bar-slot")).toHaveLength(1)
    expect(screen.getAllByText("1 unread")).toHaveLength(1)
  })

  it("keeps the search input mounted when the bulkActionBar slot is filled", () => {
    // On mobile the banner takes the search bar's vertical slot via CSS
    // (`searchSlotHiddenOnMobile`), but the input must stay in the DOM so
    // in-flight draft state and focus survive a select → clear round-trip.
    render(
      <UnifiedInboxTable
        {...defaultProps}
        bulkActionBar={<div data-testid='bulk-action-bar-slot'>banner</div>}
      />,
    )

    expect(screen.getByTestId("search-input")).toBeInTheDocument()
  })
})
