import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  DELETE_FLASH_KEY,
  MOVE_FLASH_KEY,
} from "@/components/messages/message-action-flash-keys"

const mockPush = vi.fn()
const deleteIds = vi.fn()
const moveIds = vi.fn()
const findMockMessageById = vi.fn<(id: string) => typeof MESSAGE | null>()

vi.mock("@/mock/messages", () => ({
  findMockMessageById: (id: string) => findMockMessageById(id),
}))

const MESSAGE = {
  id: "msg-1",
  subject: "Payslip for Mark Murphy",
  createdAt: "2026-04-17T10:00:00Z",
  threadName: "Payslip for Mark Murphy",
  organisationId: "org-edu",
  recipientUserId: "user-1",
  plainText: "Mark Murphy,\n\nPlease find attached your payslip.",
  isSeen: false,
  attachments: ["att-1"],
}

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
  "org-edu": {
    id: "org-edu",
    translations: {
      en: { name: "Department of Education", shortName: "DoE" },
      ga: { name: "An Roinn Oideachais", shortName: "ARO" },
    },
  },
}

let fetchState: {
  message: typeof MESSAGE | null
  isLoading: boolean
  error: { message: string } | null
} = {
  message: MESSAGE,
  isLoading: false,
  error: null,
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/en/messages",
}))

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (namespace: string) => (key: string) => {
    const byNamespace: Record<string, Record<string, string>> = {
      "home.button": { back: "Back" },
      "home.move": { toolbar: "Move" },
      "home.move.modal": {
        inbox: "Inbox",
        title: "Move message(s)",
        chooseFolder: "Choose a folder to move to",
        move: "Move",
        cancel: "Cancel",
        close: "Close",
      },
      "home.delete.confirm": {
        title: "Delete message?",
        body: "This message will be removed from your inbox.",
        cta: "Delete",
        cancel: "Cancel",
        close: "Close",
      },
      "home.detail": {
        from: "From",
        to: "To",
        date: "Date",
        delete: "Delete",
        toolbarAriaLabel: "Message actions",
        attachmentOnlyFallback:
          "Please select the attachment(s) to preview your message content",
      },
      "home.table": { unknownSender: "Unknown sender" },
      "navigation.back": { ariaLabel: "Go back" },
    }
    return byNamespace[namespace]?.[key] ?? key
  },
}))

vi.mock("@ogcio/sag-client/react", () => ({
  useAuth: () => ({ user: { sub: "user-1", name: "Mark Murphy" } }),
  useGatewayFetch: (path: string | null) => {
    if (path?.startsWith("/messaging/api/v1/messages/")) {
      return {
        data: fetchState.message,
        error: fetchState.error,
        isLoading: fetchState.isLoading,
        refresh: vi.fn(),
      }
    }
    if (path?.match(/^\/profile\/api\/v1\/organisations\//)) {
      const id = path.split("/").pop() ?? ""
      return {
        data: ORG_FIXTURES[id],
        error: null,
        isLoading: false,
        refresh: vi.fn(),
      }
    }
    if (path?.startsWith("/profile/api/v1/profiles/")) {
      return {
        data: { publicName: "Mark Murphy" },
        error: null,
        isLoading: false,
        refresh: vi.fn(),
      }
    }
    if (path === "/upload/api/v1/metadata/att-1") {
      return {
        data: {
          id: "att-1",
          fileName: "Payslip - Mark Murphy - 26-03-2026.pdf",
          fileSize: 230000,
          mimeType: "application/pdf",
          key: "k",
          ownerId: "o",
          createdAt: "2026-04-17T10:00:00Z",
        },
        error: null,
        isLoading: false,
        refresh: vi.fn(),
      }
    }
    return { data: undefined, error: null, isLoading: false, refresh: vi.fn() }
  },
  useGatewayDownload: () => ({
    download: vi.fn(),
    isDownloading: false,
  }),
}))

vi.mock("@/components/messages/use-mark-message-as-read", () => ({
  useMarkMessageAsRead: vi.fn(),
}))

vi.mock("@/components/messages/use-delete-messages", () => ({
  useDeleteMessages: () => ({
    deleteIds,
    isLoading: false,
  }),
}))

vi.mock("@/components/messages/use-move-messages", () => ({
  useMoveMessages: () => ({
    moveIds,
    isLoading: false,
  }),
}))

vi.mock("@/components/messages/move-message-modal", () => ({
  MoveMessageModal: ({
    isOpen,
    onConfirm,
  }: {
    isOpen: boolean
    onConfirm: (folderId: string | null) => void
  }) =>
    isOpen ? (
      <button
        type='button'
        data-testid='move-confirmation-confirm'
        onClick={() => onConfirm("mock-folder-ehic")}
      >
        Move
      </button>
    ) : null,
}))

vi.mock("@/components/messages/secure-email-viewer", () => ({
  SecureEmailViewer: ({ content }: { content: string }) => (
    <div data-testid='secure-email-viewer'>{content}</div>
  ),
}))

vi.mock("@ogcio/design-system-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ogcio/design-system-react")>()
  return {
    ...actual,
    Link: ({
      children,
      onClick,
      ...rest
    }: {
      children: React.ReactNode
      onClick?: (e: React.MouseEvent) => void
    } & Record<string, unknown>) => (
      <a href='#' onClick={onClick} {...rest}>
        {children}
      </a>
    ),
    SectionBreak: () => <hr data-testid='section-break' />,
  }
})

import { MessageDetailView } from "@/components/messages/message-detail-view"

describe("MessageDetailView", () => {
  beforeEach(() => {
    mockPush.mockReset()
    deleteIds.mockReset()
    moveIds.mockReset()
    findMockMessageById.mockReset()
    findMockMessageById.mockReturnValue(null)
    sessionStorage.clear()
    fetchState = {
      message: MESSAGE,
      isLoading: false,
      error: null,
    }
    deleteIds.mockResolvedValue({ ok: true, ids: ["msg-1"] })
    moveIds.mockResolvedValue({
      ok: true,
      ids: ["msg-1"],
      folderId: "mock-folder-ehic",
    })
    vi.spyOn(window.history, "back").mockImplementation(() => {})
  })

  it("shows a loading spinner while the message is fetching", () => {
    fetchState = { message: null, isLoading: true, error: null }
    render(<MessageDetailView id='msg-1' />)
    expect(screen.getByLabelText("Loading")).toBeInTheDocument()
  })

  it("shows an error state when the message cannot be loaded", () => {
    fetchState = {
      message: null,
      isLoading: false,
      error: { message: "Message not found" },
    }
    render(<MessageDetailView id='missing-message-id' />)
    expect(screen.getByText("Message not found")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Go back" })).toBeInTheDocument()
  })

  it("falls back to mock data when the API errors but a fixture exists", () => {
    const mockMessageId = "00000001-0000-4000-8000-000000000001"
    const mockMessage = {
      ...MESSAGE,
      id: mockMessageId,
      subject: "Please find attached your payslip for the month of August.",
    }
    findMockMessageById.mockReturnValue(mockMessage)
    fetchState = {
      message: null,
      isLoading: false,
      error: { message: "HTTP error! status: 422 Unprocessable Entity" },
    }
    render(<MessageDetailView id={mockMessageId} />)
    expect(
      screen.queryByText("HTTP error! status: 422 Unprocessable Entity"),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("heading", {
        name: "Please find attached your payslip for the month of August.",
      }),
    ).toBeInTheDocument()
  })

  it("renders the redesigned layout with metadata, body, and attachments", () => {
    render(<MessageDetailView id='msg-1' />)

    expect(
      screen.getByRole("heading", { name: "Payslip for Mark Murphy" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Department of Education")).toBeInTheDocument()
    expect(screen.getByText("17 April 2026")).toBeInTheDocument()
    expect(
      screen.getByText(/Please find attached your payslip\./),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Payslip - Mark Murphy - 26-03-2026.pdf"),
    ).toBeInTheDocument()
    expect(
      screen.getByTestId("attachment-preview-action"),
    ).toBeInTheDocument()
    expect(
      screen.getByTestId("attachment-download-action"),
    ).toBeInTheDocument()
  })

  it("opens the delete confirmation modal and redirects with a flash on confirm", async () => {
    render(<MessageDetailView id='msg-1' />)

    fireEvent.click(screen.getByTestId("detail-delete-button"))
    expect(screen.getByTestId("delete-confirmation-modal")).toBeInTheDocument()

    fireEvent.click(screen.getByTestId("delete-confirmation-confirm"))

    await waitFor(() => {
      expect(deleteIds).toHaveBeenCalledWith(["msg-1"])
    })
    expect(JSON.parse(sessionStorage.getItem(DELETE_FLASH_KEY)!)).toEqual({
      ok: true,
      ids: ["msg-1"],
    })
    expect(mockPush).toHaveBeenCalledWith("/en/messages")
  })

  it("opens the move modal and redirects with a flash on confirm", async () => {
    render(<MessageDetailView id='msg-1' />)

    fireEvent.click(screen.getByTestId("detail-move-button"))
    fireEvent.click(screen.getByTestId("move-confirmation-confirm"))

    await waitFor(() => {
      expect(moveIds).toHaveBeenCalledWith(["msg-1"], "mock-folder-ehic")
    })
    expect(JSON.parse(sessionStorage.getItem(MOVE_FLASH_KEY)!)).toEqual({
      ok: true,
      ids: ["msg-1"],
      folderId: "mock-folder-ehic",
    })
    expect(mockPush).toHaveBeenCalledWith("/en/messages")
  })
})
