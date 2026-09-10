import { flexRender } from "@tanstack/react-table"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EmailProviderForm } from "./EmailProviderForm"
import EmailProviders from "./EmailProviders"
import { EmailProviderFormClient } from "./email-provider-form-client"
import { ProvidersPageClient } from "./providers-page-client"

const {
  fetchMock,
  mutationMock,
  pushMock,
  refreshMock,
  searchParamsMock,
  toasterCreate,
  triggerMock,
} = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_BASE_URL ??= "http://localhost:3022"
  process.env.NEXT_PUBLIC_SAG_URL ??= "http://localhost:3030"

  return {
    fetchMock: vi.fn(),
    mutationMock: vi.fn(),
    pushMock: vi.fn(),
    refreshMock: vi.fn(),
    searchParamsMock: new URLSearchParams(),
    toasterCreate: vi.fn(),
    triggerMock: vi.fn(),
  }
})

vi.mock("@ogcio/sag-client/react", () => ({
  useGatewayFetch: (path: string | null) => fetchMock(path),
  useGatewayMutation: (path: string | null, options: unknown) =>
    mutationMock(path, options),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => searchParamsMock,
}))

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: { name?: string }) =>
    values?.name ? `${key}:${values.name}` : key,
}))

vi.mock("@/hooks/use-organization-id", () => ({
  useOrganizationId: () => "org-1",
}))

vi.mock("@/components/BackButton", () => ({
  BackLink: ({ children }: { children: ReactNode }) => (
    <a href='/'>{children}</a>
  ),
}))

vi.mock("@ogcio/design-system-react", () => ({
  Breadcrumbs: ({ children }: { children: ReactNode }) => <nav>{children}</nav>,
  BreadcrumbLink: ({ children }: { children: ReactNode }) => (
    <a href='/'>{children}</a>
  ),
  BreadcrumbCurrentLink: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
  Button: ({
    children,
    onClick,
    type = "button",
    ariaLabel,
    disabled,
  }: {
    children: ReactNode
    onClick?: () => void
    type?: "button" | "submit"
    ariaLabel?: string
    disabled?: boolean
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
  FormField: ({
    children,
    label,
    error,
  }: {
    children?: ReactNode
    label?: { text: string; htmlFor: string }
    error?: { text: string }
  }) => (
    <div>
      {label && <label htmlFor={label.htmlFor}>{label.text}</label>}
      {children}
      {error?.text}
    </div>
  ),
  Heading: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
  InputCheckbox: ({
    id,
    name,
    label,
    defaultChecked,
  }: {
    id: string
    name: string
    label: string
    defaultChecked?: boolean
  }) => (
    <label>
      <input
        id={id}
        name={name}
        type='checkbox'
        defaultChecked={defaultChecked}
      />
      {label}
    </label>
  ),
  InputText: ({
    id,
    name,
    type = "text",
    defaultValue,
  }: {
    id: string
    name: string
    type?: string
    defaultValue?: string
  }) => <input id={id} name={name} type={type} defaultValue={defaultValue} />,
  Link: ({ children, href }: { children: ReactNode; href?: string }) => (
    <a href={href}>{children}</a>
  ),
  ModalWrapper: ({
    children,
    isOpen,
  }: {
    children: ReactNode
    isOpen: boolean
  }) => (isOpen ? <div role='dialog'>{children}</div> : null),
  ModalTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  ModalBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ModalFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Paragraph: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Spinner: () => <span data-testid='spinner' />,
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  toaster: { create: toasterCreate },
}))

vi.mock("@/components/icons/delete", () => ({
  DeleteIcon: () => <span>delete icon</span>,
}))

vi.mock("@/components/tables/TanStackTable", () => ({
  TanStackTable: ({
    table,
    emptyMessage,
    errorMessage,
  }: {
    table: {
      getRowModel: () => {
        rows: Array<{
          id: string
          getVisibleCells: () => Array<{
            id: string
            column: { columnDef: { cell?: unknown } }
            getContext: () => unknown
          }>
        }>
      }
    }
    emptyMessage?: string
    errorMessage?: string
  }) => (
    <div data-testid='providers-table'>
      {errorMessage ?? emptyMessage}
      {table.getRowModel().rows.map((row) => (
        <div key={row.id}>
          {row.getVisibleCells().map((cell) => (
            <span key={cell.id}>
              {flexRender(
                cell.column.columnDef.cell as never,
                cell.getContext() as never,
              )}
            </span>
          ))}
        </div>
      ))}
    </div>
  ),
}))

beforeEach(() => {
  vi.clearAllMocks()
  for (const key of [...searchParamsMock.keys()]) {
    searchParamsMock.delete(key)
  }
  fetchMock.mockReturnValue({
    data: [],
    error: null,
    isLoading: false,
    refresh: refreshMock,
  })
  mutationMock.mockReturnValue({
    trigger: triggerMock,
    isLoading: false,
  })
})

describe(ProvidersPageClient.name, () => {
  it("renders the settings heading, add link, and provider list", () => {
    render(<ProvidersPageClient />)

    expect(screen.getByRole("heading", { name: "header" })).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "addProvider" }),
    ).toBeInTheDocument()
    expect(screen.getByTestId("providers-table")).toBeInTheDocument()
  })
})

describe(EmailProviderFormClient.name, () => {
  it("waits for an existing provider and then passes it to the form", () => {
    searchParamsMock.set("id", "provider-1")
    fetchMock.mockReturnValueOnce({ data: undefined, isLoading: true })
    const { rerender } = render(<EmailProviderFormClient />)
    expect(screen.queryByRole("heading")).not.toBeInTheDocument()

    fetchMock.mockReturnValue({
      data: {
        id: "provider-1",
        providerName: "SMTP",
        fromAddress: "sender@example.com",
      },
      isLoading: false,
    })
    rerender(<EmailProviderFormClient />)

    expect(
      screen.getByRole("heading", { name: "titleUpdate" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("nameLabel")).toHaveValue("SMTP")
  })
})

describe(EmailProviders.name, () => {
  it("renders providers and opens the delete confirmation", async () => {
    const user = userEvent.setup()
    fetchMock.mockReturnValue({
      data: [{ id: "provider-1", providerName: "SMTP", isPrimary: true }],
      error: null,
      isLoading: false,
      refresh: refreshMock,
    })

    render(<EmailProviders />)

    expect(screen.getByText("SMTP")).toBeInTheDocument()
    expect(screen.getByText("primaryCellValue")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "deleteButton" }))
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "deleteModalTitle:SMTP",
    )
  })

  it("renders the empty state", () => {
    render(<EmailProviders />)
    expect(screen.getByTestId("providers-table")).toHaveTextContent(
      "noProviders",
    )
  })

  it("deletes a provider and refreshes the list", async () => {
    fetchMock.mockReturnValue({
      data: [{ id: "provider-1", providerName: "SMTP", isPrimary: false }],
      error: null,
      isLoading: false,
      refresh: refreshMock,
    })
    triggerMock.mockResolvedValue(undefined)
    render(<EmailProviders />)

    await userEvent.click(screen.getByRole("button", { name: "deleteButton" }))
    await userEvent.click(screen.getByRole("button", { name: "modalDelete" }))

    expect(triggerMock).toHaveBeenCalledOnce()
    expect(refreshMock).toHaveBeenCalledOnce()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("shows fetch and delete errors", async () => {
    fetchMock.mockReturnValue({
      data: [{ id: "provider-1", providerName: "SMTP" }],
      error: new Error("failed"),
      isLoading: false,
      refresh: refreshMock,
    })
    const { rerender } = render(<EmailProviders />)
    expect(toasterCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "genericServerError" }),
    )

    fetchMock.mockReturnValue({
      data: [{ id: "provider-1", providerName: "SMTP" }],
      error: null,
      isLoading: false,
      refresh: refreshMock,
    })
    triggerMock.mockRejectedValue(new Error("failed"))
    rerender(<EmailProviders />)
    await userEvent.click(screen.getByRole("button", { name: "deleteButton" }))
    await userEvent.click(screen.getByRole("button", { name: "modalDelete" }))

    expect(screen.getByRole("dialog")).toHaveTextContent("failedToDelete")
  })

  it("cancels provider deletion", async () => {
    fetchMock.mockReturnValue({
      data: [{ id: "provider-1", providerName: "SMTP" }],
      error: null,
      isLoading: false,
      refresh: refreshMock,
    })
    render(<EmailProviders />)

    await userEvent.click(screen.getByRole("button", { name: "deleteButton" }))
    await userEvent.click(screen.getByRole("button", { name: "modalCancel" }))

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(triggerMock).not.toHaveBeenCalled()
  })
})

describe(EmailProviderForm.name, () => {
  it("renders create and update variants", () => {
    const { rerender } = render(<EmailProviderForm />)
    expect(
      screen.getByRole("heading", { name: "titleAdd" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "createButton" }),
    ).toBeInTheDocument()

    rerender(
      <EmailProviderForm
        provider={{
          id: "provider-1",
          providerName: "SMTP",
          fromAddress: "sender@example.com",
          host: "smtp.example.com",
          port: 587,
          username: "user",
          isPrimary: false,
          headers: null,
        }}
      />,
    )

    expect(
      screen.getByRole("heading", { name: "titleUpdate" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "updateButton" }),
    ).toBeInTheDocument()
  })

  it("validates required create fields", async () => {
    render(<EmailProviderForm />)

    await userEvent.click(screen.getByRole("button", { name: "createButton" }))

    expect(screen.getByText("name")).toBeInTheDocument()
    expect(screen.getByText("host")).toBeInTheDocument()
    expect(screen.getByText(/invalidEmail/)).toBeInTheDocument()
    expect(triggerMock).not.toHaveBeenCalled()
  })

  it("creates a provider from valid form values", async () => {
    triggerMock.mockResolvedValue({ id: "provider-1" })
    render(<EmailProviderForm />)

    await userEvent.type(screen.getByLabelText("nameLabel"), "SMTP")
    await userEvent.type(
      screen.getByLabelText("fromAddressLabel"),
      "sender@example.com",
    )
    await userEvent.type(screen.getByLabelText("hostLabel"), "smtp.example.com")
    await userEvent.type(screen.getByLabelText("portLabel"), "587")
    await userEvent.type(screen.getByLabelText("usernameLabel"), "user")
    await userEvent.type(screen.getByLabelText("passwordLabel"), "secret")
    fireEvent.change(screen.getByLabelText("headersLabel"), {
      target: { value: '{"X-Test":"yes"}' },
    })
    await userEvent.click(screen.getByRole("button", { name: "createButton" }))

    expect(triggerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerName: "SMTP",
        smtpPort: 587,
        headers: { "X-Test": "yes" },
      }),
    )
    expect(pushMock).toHaveBeenCalledWith("/en/providers")
  })

  it("updates a provider without an optional password", async () => {
    triggerMock.mockResolvedValue({ id: "provider-1" })
    render(
      <EmailProviderForm
        provider={{
          id: "provider-1",
          providerName: "SMTP",
          fromAddress: "sender@example.com",
          host: "smtp.example.com",
          port: 587,
          username: "user",
          isPrimary: false,
          headers: null,
        }}
      />,
    )

    await userEvent.click(screen.getByRole("button", { name: "updateButton" }))

    expect(triggerMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "provider-1", providerName: "SMTP" }),
    )
    expect(triggerMock.mock.calls[0][0]).not.toHaveProperty("password")
    expect(pushMock).toHaveBeenCalledWith("/en/providers")
  })

  it("reports provider save failures", async () => {
    triggerMock.mockRejectedValue(new Error("failed"))
    render(<EmailProviderForm />)

    await userEvent.type(screen.getByLabelText("nameLabel"), "SMTP")
    await userEvent.type(
      screen.getByLabelText("fromAddressLabel"),
      "sender@example.com",
    )
    await userEvent.type(screen.getByLabelText("hostLabel"), "smtp.example.com")
    await userEvent.type(screen.getByLabelText("portLabel"), "587")
    await userEvent.type(screen.getByLabelText("usernameLabel"), "user")
    await userEvent.type(screen.getByLabelText("passwordLabel"), "secret")
    await userEvent.type(screen.getByLabelText("headersLabel"), "not-json")
    await userEvent.click(screen.getByRole("button", { name: "createButton" }))

    expect(await screen.findByText("error.server")).toBeInTheDocument()
    expect(toasterCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "error.server" }),
    )
  })
})
