import { flexRender } from "@tanstack/react-table"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import TemplatesList from "@/components/message-templates/TemplatesList"

const {
  pushMock,
  replaceMock,
  searchParamsMock,
  useGatewayFetchMock,
  refreshMock,
  deleteTemplateMock,
  toasterCreate,
  trackEvent,
} = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_BASE_URL ??= "http://localhost:3022"
  process.env.NEXT_PUBLIC_SAG_URL ??= "http://localhost:3030"

  return {
    pushMock: vi.fn(),
    replaceMock: vi.fn(),
    searchParamsMock: new URLSearchParams(),
    useGatewayFetchMock: vi.fn(),
    refreshMock: vi.fn(),
    deleteTemplateMock: vi.fn(),
    toasterCreate: vi.fn(),
    trackEvent: vi.fn(),
  }
})

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  usePathname: () => "/en/message-templates",
  useSearchParams: () => searchParamsMock,
}))

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}))

vi.mock("@ogcio/nextjs-analytics", () => ({
  useAnalytics: () => ({ trackEvent }),
}))

vi.mock("@/hooks/use-organization-id", () => ({
  useOrganizationId: () => "org-1",
}))

vi.mock("@ogcio/sag-client/react", () => ({
  useGatewayFetch: (path: string) => useGatewayFetchMock(path),
  useGatewayMutation: () => ({
    trigger: deleteTemplateMock,
    isLoading: false,
  }),
}))

vi.mock("@/components/containers", () => ({
  FullWidthContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  TwoColumnLayout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

vi.mock("@/components/tables/TanStackTable", () => ({
  TanStackTable: ({
    emptyMessage,
    table,
  }: {
    emptyMessage?: string
    table: {
      getRowModel: () => {
        rows: Array<{
          id: string
          getVisibleCells: () => Array<{
            id: string
            column: { columnDef: { cell?: unknown } }
            getContext: () => unknown
            getValue: () => unknown
          }>
        }>
      }
    }
  }) => (
    <div data-testid='templates-table'>
      {emptyMessage}
      {table
        .getRowModel()
        .rows.map((row) =>
          row
            .getVisibleCells()
            .map((cell) => (
              <span key={cell.id}>
                {cell.column.columnDef.cell
                  ? flexRender(
                      cell.column.columnDef.cell as Parameters<
                        typeof flexRender
                      >[0],
                      cell.getContext() as Parameters<typeof flexRender>[1],
                    )
                  : String(cell.getValue())}
              </span>
            )),
        )}
    </div>
  ),
}))

vi.mock("@ogcio/design-system-react", () => ({
  Button: ({
    children,
    ariaLabel,
    disabled,
    type = "button",
    onClick,
  }: {
    children: React.ReactNode
    ariaLabel?: string
    disabled?: boolean
    type?: "button" | "submit" | "reset"
    onClick?: () => void
  }) => (
    <button
      type={type}
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
    >
      {children}
    </button>
  ),
  TextInput: ({
    name,
    value,
    onChange,
    placeholder,
  }: {
    name?: string
    value?: string
    onChange?: React.ChangeEventHandler<HTMLInputElement>
    placeholder?: string
  }) => (
    <input
      name={name}
      value={value ?? ""}
      onChange={onChange}
      placeholder={placeholder}
      aria-label={placeholder}
    />
  ),
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Link: ({
    children,
    href,
    onClick,
  }: {
    children: React.ReactNode
    href?: string
    onClick?: () => void
  }) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
  ModalWrapper: ({
    children,
    isOpen,
  }: {
    children: React.ReactNode
    isOpen?: boolean
  }) => (isOpen ? <div role='dialog'>{children}</div> : null),
  ModalTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  ModalBody: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ModalFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Paragraph: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  FormField: ({
    children,
    error,
  }: {
    children?: React.ReactNode
    error?: { text: string }
  }) => (
    <div>
      {children}
      {error?.text}
    </div>
  ),
  IconButton: () => <button type='button'>delete</button>,
  Spinner: () => <span />,
  toaster: { create: toasterCreate },
}))

const sampleTemplates = [
  {
    id: "tpl-1",
    contents: [{ language: "en", templateName: "matteo" }],
  },
]

describe(TemplatesList.name, () => {
  beforeEach(() => {
    pushMock.mockReset()
    replaceMock.mockReset()
    refreshMock.mockReset()
    for (const key of [...searchParamsMock.keys()]) {
      searchParamsMock.delete(key)
    }
    useGatewayFetchMock.mockImplementation(() => ({
      data: sampleTemplates,
      isLoading: false,
      error: null,
      refresh: refreshMock,
    }))
  })

  it("fetches templates using the search query param from the URL", () => {
    searchParamsMock.set("search", "E2E")

    render(<TemplatesList />)

    expect(useGatewayFetchMock).toHaveBeenCalledWith(
      "/messaging/api/v1/templates?search=E2E&limit=100",
    )
  })

  it("pushes the search term to the URL when the search form is submitted", async () => {
    const user = userEvent.setup()
    render(<TemplatesList />)

    await user.type(screen.getByPlaceholderText("input.placeholder"), "E2E")
    await user.click(screen.getByRole("button", { name: "button.search" }))

    expect(pushMock).toHaveBeenCalledWith("?search=E2E")
  })

  it("pushes the search term to the URL when Enter is pressed in the search input", async () => {
    const user = userEvent.setup()
    render(<TemplatesList />)

    await user.type(
      screen.getByPlaceholderText("input.placeholder"),
      "E2E{Enter}",
    )

    expect(pushMock).toHaveBeenCalledWith("?search=E2E")
  })

  it("removes search from the URL when reset is clicked", async () => {
    searchParamsMock.set("search", "E2E")
    const user = userEvent.setup()
    render(<TemplatesList />)

    await user.click(screen.getByRole("button", { name: "button.reset" }))

    expect(pushMock).toHaveBeenCalledWith("?")
  })

  it("preserves search when clearing newid from the URL", () => {
    searchParamsMock.set("search", "E2E")
    searchParamsMock.set("newid", "tpl-1")

    render(<TemplatesList />)

    expect(replaceMock).toHaveBeenCalledWith("/en/message-templates?search=E2E")
  })

  it("shows the fetch error instead of a stale template list", () => {
    useGatewayFetchMock.mockImplementation(() => ({
      data: sampleTemplates,
      isLoading: false,
      error: new Error("Forbidden"),
      refresh: refreshMock,
    }))

    render(<TemplatesList />)

    expect(screen.getByTestId("templates-table")).toHaveTextContent(
      "toaster.title.serverError",
    )
  })

  it("renders template cells and tracks edit and use actions", async () => {
    render(<TemplatesList />)

    expect(screen.getByText("matteo")).toBeInTheDocument()
    expect(screen.getByText("EN")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("link", { name: "table.link.edit" }))
    await userEvent.click(screen.getByRole("link", { name: "table.link.use" }))

    expect(trackEvent).toHaveBeenCalledTimes(2)
  })

  it("deletes a template and refreshes the list", async () => {
    deleteTemplateMock.mockResolvedValue(undefined)
    render(<TemplatesList />)

    await userEvent.click(screen.getByRole("button", { name: "button.delete" }))
    expect(screen.getByRole("dialog")).toHaveTextContent("modal.delete.title")
    await userEvent.click(
      screen.getAllByRole("button", { name: "button.delete" })[0],
    )

    expect(deleteTemplateMock).toHaveBeenCalledOnce()
    expect(refreshMock).toHaveBeenCalledOnce()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("shows delete failures and allows cancellation", async () => {
    deleteTemplateMock.mockRejectedValue(new Error("failed"))
    render(<TemplatesList />)

    await userEvent.click(screen.getByRole("button", { name: "button.delete" }))
    await userEvent.click(
      screen.getAllByRole("button", { name: "button.delete" })[0],
    )
    expect(await screen.findByText("modal.delete.error")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "button.cancel" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("announces a newly created template", () => {
    searchParamsMock.set("newid", "tpl-1")
    render(<TemplatesList />)

    expect(toasterCreate).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    )
    expect(replaceMock).toHaveBeenCalledWith("/en/message-templates")
  })

  it("submits an empty search by removing the existing filter", async () => {
    searchParamsMock.set("search", "old")
    render(<TemplatesList />)
    await userEvent.clear(screen.getByPlaceholderText("input.placeholder"))
    await userEvent.click(screen.getByRole("button", { name: "button.search" }))

    expect(pushMock).toHaveBeenCalledWith("?")
  })
})
