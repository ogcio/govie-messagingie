import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { UnifiedInboxTable } from "@/components/messages/unified-inbox-table"
import { useMessageSelection } from "@/components/messages/use-message-selection"
import type { Message } from "@/types"

const mockPush = vi.fn()
let currentSearchParams = new URLSearchParams()
const MOCK_PATHNAME = "/en/messages"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => currentSearchParams,
  usePathname: () => MOCK_PATHNAME,
}))

/**
 * The `<SenderName>` component looks up `organisationId` against the
 * profile service via SWR, so the table now triggers a real network
 * dependency in jsdom. We stub the SWR-backed hook with a synchronous
 * fixture map so tests can assert the resolved org name without spinning
 * up a fake fetch + suspending on micro-tasks. Unknown ids fall through
 * to `data: undefined`, which the component renders as the localized
 * "Unknown sender" fallback — useful for the negative-path test below.
 */
const ORG_FIXTURES: Record<
  string,
  {
    id: string
    translations: {
      en: { name: string; shortName: string }
      ga: { name: string; shortName: string }
    }
  }
> = {
  "org-dsp": {
    id: "org-dsp",
    translations: {
      en: {
        name: "Department of Social Protection",
        shortName: "DSP",
      },
      ga: {
        name: "An Roinn Coimirce Sóisialaí",
        shortName: "RCS",
      },
    },
  },
  "org-rev": {
    id: "org-rev",
    translations: {
      en: { name: "Revenue", shortName: "REV" },
      ga: { name: "Na Coimisinéirí Ioncaim", shortName: "NCI" },
    },
  },
}

vi.mock("@ogcio/sag-client/react", () => ({
  useGatewayFetch: (path: string | null) => {
    if (!path) {
      return {
        data: undefined,
        metadata: undefined,
        error: null,
        isLoading: false,
        refresh: vi.fn(),
      }
    }
    const orgMatch = path.match(/^\/profile\/api\/v1\/organisations\/(.+)$/)
    const data = orgMatch ? ORG_FIXTURES[orgMatch[1]] : undefined
    return {
      data,
      metadata: undefined,
      error: null,
      isLoading: false,
      refresh: vi.fn(),
    }
  },
}))

vi.mock("next-intl", () => ({
  useLocale: () => "en",
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
        "home.table.rowsPerPage": "Rows per page",
        "home.table.from": "From",
        "home.table.unknownSender": "Unknown sender",
        "home.table.systemSender.support": "MessagingIE",
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

// `threadName` mirrors `subject` here on purpose: that's how the
// messaging-api list endpoint actually returns rows (the field is a
// grouping key, not a sender name). Pinning the fixture this way locks
// in the AB#37868 regression — the Sender column must resolve from
// `organisationId` via the profile lookup, never echo `threadName` /
// `subject` back at the user.
const baseMessage: Message = {
  id: "msg-1",
  subject: "Your annual statement is available",
  createdAt: "2025-01-15T10:30:00Z",
  threadName: "Your annual statement is available",
  organisationId: "org-dsp",
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
    threadName: "Payment confirmation",
    organisationId: "org-rev",
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
function TableWithSelection(
  props: {
    selectMode?: boolean
    onEnterSelectMode?: () => void
    onExitSelectMode?: () => void
    onOpenFolders?: () => void
    onBulkMove?: () => void
    canMove?: boolean
  } = {},
) {
  const selection = useMessageSelection(messages)
  // The mobile "Select" button (data-testid=mobile-select-button) is
  // gated on a truthy onEnterSelectMode handler — its absence is how
  // the messages page tells the table that mobile select-mode is not
  // wired up. The default wrapper supplies a no-op so the button is
  // rendered for assertions; tests that exercise the click handler
  // pass their own spy.
  return (
    <UnifiedInboxTable
      {...defaultProps}
      selection={selection}
      selectMode={props.selectMode}
      onEnterSelectMode={props.onEnterSelectMode ?? (() => {})}
      onExitSelectMode={props.onExitSelectMode ?? (() => {})}
      onOpenFolders={props.onOpenFolders}
      onBulkMove={props.onBulkMove}
      canMove={props.canMove}
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
    expect(screen.getAllByText("Payment confirmation").length).toBeGreaterThan(
      0,
    )
  })

  // AB#37868 regression: the Sender column must surface the
  // organisation's localized display name resolved from
  // `organisationId`, never `threadName` (which the messaging-api wires
  // up to the subject for thread grouping). The fixtures above
  // intentionally set `threadName === subject`, so a sloppy "show
  // whatever's in threadName" implementation would render the subject
  // in this column.
  it("renders the resolved organisation name in the Sender column", () => {
    render(<UnifiedInboxTable {...defaultProps} />)

    const senderTexts = Array.from(
      screen
        .getByTestId("unified-inbox-table")
        .querySelectorAll<HTMLElement>("tbody tr td:nth-child(1) span"),
    ).map((node) => node.textContent?.trim())

    expect(senderTexts).toEqual(["Department of Social Protection", "Revenue"])
    // The subject must NOT leak into the Sender column even though
    // `threadName === subject` for both rows.
    expect(senderTexts).not.toContain("Your annual statement is available")
    expect(senderTexts).not.toContain("Payment confirmation")
  })

  it("falls back to the unknown-sender label when the organisation lookup has no data", () => {
    const orphan: Message[] = [
      {
        ...baseMessage,
        id: "msg-orphan",
        subject: "Quarterly tax return reminder",
        threadName: "Quarterly tax return reminder",
        organisationId: "org-not-seeded",
      },
    ]

    render(<UnifiedInboxTable {...defaultProps} messages={orphan} />)

    const senderTexts = Array.from(
      screen
        .getByTestId("unified-inbox-table")
        .querySelectorAll<HTMLElement>("tbody tr td:nth-child(1) span"),
    ).map((node) => node.textContent?.trim())

    expect(senderTexts).toEqual(["Unknown sender"])
    // Defensive: the subject must NOT be used as a fallback either, even
    // when the org lookup misses.
    expect(senderTexts).not.toContain("Quarterly tax return reminder")
    // Raw UUID must never reach the UI.
    expect(senderTexts).not.toContain("org-not-seeded")
  })

  // AB#37866 regression: messages produced by the messaging-api itself
  // (e.g. data-export-ready notifications) carry `organisationId =
  // "support"`, which is the literal default of the messaging-api
  // SUPPORT_ORGANISATION_ID env var, NOT a real UUID. The Sender column
  // must short-circuit the doomed profile lookup for these and render a
  // localized brand label instead of the "Unknown sender" fallback.
  it("renders the system-sender brand label for messages stamped with the support slug", () => {
    const systemMessage: Message[] = [
      {
        ...baseMessage,
        id: "msg-system",
        subject: "Your MessagingIE Data Export is Ready",
        threadName: "Your MessagingIE Data Export is Ready",
        organisationId: "support",
      },
    ]

    render(<UnifiedInboxTable {...defaultProps} messages={systemMessage} />)

    const senderTexts = Array.from(
      screen
        .getByTestId("unified-inbox-table")
        .querySelectorAll<HTMLElement>("tbody tr td:nth-child(1) span"),
    ).map((node) => node.textContent?.trim())

    expect(senderTexts).toEqual(["MessagingIE"])
    // The slug must NEVER reach the UI raw, and the unknown-sender
    // fallback must NEVER fire for known system slugs.
    expect(senderTexts).not.toContain("support")
    expect(senderTexts).not.toContain("Unknown sender")
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

    expect(mockPush).toHaveBeenCalledWith(`${MOCK_PATHNAME}?search=statement`)
  })

  it("clears the ?search= param when Enter is pressed on an empty input", () => {
    // Reproduces the prior bug where `router.push("?")` was a no-op in the
    // Next.js App Router, so users who emptied the input and hit Enter
    // stayed stuck on the previous filtered URL.
    currentSearchParams = new URLSearchParams("search=available")
    try {
      render(<UnifiedInboxTable {...defaultProps} />)

      const input = screen.getByTestId("search-input")
      fireEvent.change(input, { target: { value: "" } })
      fireEvent.keyDown(input, { key: "Enter" })

      expect(mockPush).toHaveBeenCalledWith(MOCK_PATHNAME)
    } finally {
      currentSearchParams = new URLSearchParams()
    }
  })

  it("shows loading state", () => {
    render(<UnifiedInboxTable {...defaultProps} messages={[]} isLoading />)

    // Spinner is rendered inside an <output aria-label="Loading"> wrapper
    // (the shared <MessagesLoading /> component used by the page-level
    // suspense fallback), so we assert on the accessible label rather than
    // on the previous "Loading messages..." copy.
    expect(screen.getByLabelText("Loading")).toBeInTheDocument()
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

    const rowCheckbox = screen.getByTestId(
      "select-row-msg-1",
    ) as HTMLInputElement
    expect(rowCheckbox.checked).toBe(false)
    fireEvent.click(rowCheckbox)
    expect(rowCheckbox.checked).toBe(true)
  })

  it("select-all toggles every visible row", () => {
    render(<TableWithSelection />)

    const selectAll = screen.getByTestId(
      "select-all-checkbox",
    ) as HTMLInputElement
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

    // The DS InputCheckbox does NOT imperatively flip the native
    // HTMLInputElement.indeterminate property — see the comment block on
    // `selectionCheckboxProps` in unified-inbox-table.tsx. It signals the
    // mixed state via (a) aria-checked="mixed" and (b) the
    // .gi-checkbox-indeterminate class that drives the dash-on-fill visual.
    // Asserting on `.indeterminate` directly is a false negative; the
    // assertions below pin the contract the screen reader and the CSS
    // actually rely on.
    //
    // The DS component also recreates its internal <input> when the
    // `indeterminate`/`checked` prop combination flips, so we must
    // re-query the testid after each interaction rather than caching a
    // stale node reference.
    const initial = screen.getByTestId(
      "select-all-checkbox",
    ) as HTMLInputElement
    expect(initial.checked).toBe(false)
    expect(initial.getAttribute("aria-checked")).toBe("false")
    expect(initial.className).not.toMatch(/gi-checkbox-indeterminate/)

    fireEvent.click(screen.getByTestId("select-row-msg-1"))

    const partial = screen.getByTestId(
      "select-all-checkbox",
    ) as HTMLInputElement
    expect(partial.getAttribute("aria-checked")).toBe("mixed")
    expect(partial.className).toMatch(/gi-checkbox-indeterminate/)

    fireEvent.click(screen.getByTestId("select-row-msg-2"))

    const full = screen.getByTestId("select-all-checkbox") as HTMLInputElement
    expect(full.checked).toBe(true)
    expect(full.getAttribute("aria-checked")).toBe("true")
    expect(full.className).not.toMatch(/gi-checkbox-indeterminate/)
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
    expect(screen.queryByTestId("mobile-select-button")).not.toBeInTheDocument()
  })

  it("mobile Select button calls onEnterSelectMode", () => {
    const onEnterSelectMode = vi.fn()
    render(<TableWithSelection onEnterSelectMode={onEnterSelectMode} />)

    fireEvent.click(screen.getByTestId("mobile-select-button"))
    expect(onEnterSelectMode).toHaveBeenCalledTimes(1)
  })

  it("renders a mobile Folders button that opens the folder panel", () => {
    const onOpenFolders = vi.fn()
    render(<TableWithSelection onOpenFolders={onOpenFolders} />)

    fireEvent.click(screen.getByTestId("mobile-folders-button"))
    expect(onOpenFolders).toHaveBeenCalledTimes(1)
  })

  it("shows a mobile Move button in select mode only when canMove is set", () => {
    const onBulkMove = vi.fn()
    render(<TableWithSelection canMove onBulkMove={onBulkMove} />)

    // Enter select mode by selecting a row.
    fireEvent.click(screen.getByTestId("select-row-msg-1"))

    fireEvent.click(screen.getByTestId("bulk-move-button-mobile"))
    expect(onBulkMove).toHaveBeenCalledTimes(1)
  })

  it("hides the mobile Move button when canMove is false", () => {
    render(<TableWithSelection onBulkMove={vi.fn()} canMove={false} />)

    fireEvent.click(screen.getByTestId("select-row-msg-1"))

    expect(
      screen.queryByTestId("bulk-move-button-mobile"),
    ).not.toBeInTheDocument()
  })

  it("mobile Close button exits select mode and clears selection", () => {
    const onExitSelectMode = vi.fn()
    render(
      <TableWithSelection selectMode onExitSelectMode={onExitSelectMode} />,
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
