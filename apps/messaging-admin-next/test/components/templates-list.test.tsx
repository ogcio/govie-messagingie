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
} = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_BASE_URL ??= "http://localhost:3022"
  process.env.NEXT_PUBLIC_SAG_URL ??= "http://localhost:3030"

  return {
    pushMock: vi.fn(),
    replaceMock: vi.fn(),
    searchParamsMock: new URLSearchParams(),
    useGatewayFetchMock: vi.fn(),
    refreshMock: vi.fn(),
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
  useAnalytics: () => ({ trackEvent: vi.fn() }),
}))

vi.mock("@/hooks/use-organization-id", () => ({
  useOrganizationId: () => "org-1",
}))

vi.mock("@ogcio/sag-client/react", () => ({
  useGatewayFetch: (path: string) => useGatewayFetchMock(path),
  useGatewayMutation: () => ({
    trigger: vi.fn(),
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
  TanStackTable: () => <div data-testid='templates-table' />,
}))

vi.mock("@ogcio/design-system-react", () => ({
  Button: ({
    children,
    type = "button",
    onClick,
  }: {
    children: React.ReactNode
    type?: "button" | "submit" | "reset"
    onClick?: () => void
  }) => (
    <button type={type} onClick={onClick}>
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
  }: {
    children: React.ReactNode
    href?: string
  }) => <a href={href}>{children}</a>,
  ModalWrapper: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
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
  FormField: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  IconButton: () => <button type='button'>delete</button>,
  Spinner: () => <span />,
  toaster: { create: vi.fn() },
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

    expect(replaceMock).toHaveBeenCalledWith(
      "/en/message-templates?search=E2E",
    )
  })
})
