import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ComposeMessageMeta from "./ComposeMessageMeta"
import { SendMessageContext, SendMessageSteps } from "./SendMessageContext"

const { fetchMock, onStep, replaceMock, searchParams } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  onStep: vi.fn(),
  replaceMock: vi.fn(),
  searchParams: new URLSearchParams("templateId=template-2"),
}))

vi.mock("@ogcio/sag-client/react", () => ({
  useGatewayFetch: (path: string | null) => fetchMock(path),
}))
vi.mock("@ogcio/sag-client", () => ({}))
vi.mock("@/components/UserContext", () => ({
  useUser: () => ({ id: "user-1" }),
  useUserRoles: () => ({ canCreateProfiles: false, canUploadFiles: false }),
}))
vi.mock("@/hooks/use-organization-id", () => ({
  useOrganizationId: () => "org-1",
}))
vi.mock("@ogcio/nextjs-analytics", () => ({
  useAnalytics: () => ({ trackEvent: vi.fn() }),
}))
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/messages/new",
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => searchParams,
}))
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () =>
    Object.assign((key: string) => key, {
      rich: (key: string) => key,
    }),
}))
vi.mock("@/components/SubmitButton", () => ({
  SubmitButton: ({ children, disabled }: React.ComponentProps<"button">) => (
    <button type='submit' disabled={disabled}>
      {children}
    </button>
  ),
}))
vi.mock("@ogcio/design-system-react", () => ({
  Details: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  FormField: ({
    children,
    label,
  }: React.PropsWithChildren<{ label: { text: string; htmlFor: string } }>) => (
    <div>
      <label htmlFor={label.htmlFor}>{label.text}</label>
      {children}
    </div>
  ),
  Heading: ({ children }: React.PropsWithChildren) => <h1>{children}</h1>,
  Link: ({ children, href }: React.ComponentProps<"a">) => (
    <a href={href}>{children}</a>
  ),
  Paragraph: ({ children }: React.PropsWithChildren) => <p>{children}</p>,
  Radio: ({
    label,
    ...props
  }: React.ComponentProps<"input"> & { label: string }) => (
    <label>
      <input type='radio' {...props} />
      {label}
    </label>
  ),
  Select: (props: React.ComponentProps<"select">) => <select {...props} />,
  SelectItem: (props: React.ComponentProps<"option">) => <option {...props} />,
  Stack: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}))

const options = [
  {
    id: "template-1",
    contents: [{ language: "en", templateName: "Reminder" }],
  },
  { id: "template-2", contents: [{ language: "en", templateName: "Notice" }] },
]

describe(ComposeMessageMeta.name, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of [...searchParams.keys()]) searchParams.delete(key)
  })

  it("loads the requested template, previews it, and advances on submit", async () => {
    searchParams.set("templateId", "template-2")
    fetchMock.mockImplementation((path: string | null) =>
      path === null
        ? { data: undefined, isLoading: false }
        : path.includes("?") || path.endsWith("/templates")
          ? { data: options, isLoading: false }
          : {
              data: {
                contents: [
                  {
                    language: "en",
                    subject: "Account update",
                    plainText: "Please review your account",
                  },
                ],
              },
              isLoading: false,
            },
    )

    render(
      <SendMessageContext.Provider
        value={{
          userId: "user-1",
          canCreateProfiles: false,
          canUploadFiles: false,
          searchParams: {},
          message: {},
          pendingFiles: [],
          step: SendMessageSteps.meta,
          errors: {},
          setMessage: vi.fn(),
          setPendingFiles: vi.fn(),
          setSearchParams: vi.fn(),
          onStep,
          setErrors: vi.fn(),
          setStep: vi.fn(),
        }}
      >
        <ComposeMessageMeta />
      </SendMessageContext.Provider>,
    )

    expect(await screen.findByText("Account update")).toBeVisible()
    expect(
      screen.getByRole("combobox", { name: "label.template" }),
    ).toHaveValue("template-2")
    await userEvent.click(screen.getByRole("button", { name: "button.submit" }))

    expect(onStep).toHaveBeenCalledWith(
      expect.objectContaining({
        templateMetaId: "template-2",
        templateName: "Notice",
        securityLevel: "confidential",
      }),
      "next",
    )
    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith("/en/messages/new"),
    )
  })

  it("renders nothing while the template list is loading", () => {
    fetchMock.mockReturnValue({ data: undefined, isLoading: true })

    const { container } = render(
      <SendMessageContext.Provider
        value={{
          userId: "user-1",
          canCreateProfiles: false,
          canUploadFiles: false,
          searchParams: {},
          message: {},
          pendingFiles: [],
          step: SendMessageSteps.meta,
          errors: {},
          setMessage: vi.fn(),
          setPendingFiles: vi.fn(),
          setSearchParams: vi.fn(),
          onStep,
          setErrors: vi.fn(),
          setStep: vi.fn(),
        }}
      >
        <ComposeMessageMeta />
      </SendMessageContext.Provider>,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it("falls back to the first option and first available content", async () => {
    searchParams.set("templateId", "missing")
    fetchMock.mockImplementation((path: string | null) =>
      path === null
        ? { data: undefined, isLoading: false }
        : path.includes("?") || path.endsWith("/templates")
          ? { data: options, isLoading: false }
          : {
              data: {
                contents: [
                  {
                    language: "ga",
                    subject: "Ábhar",
                    plainText: "Téacs",
                    richText: "",
                  },
                ],
              },
              isLoading: false,
            },
    )

    render(
      <SendMessageContext.Provider
        value={{
          userId: "user-1",
          canCreateProfiles: false,
          canUploadFiles: false,
          searchParams: {},
          message: {},
          pendingFiles: [],
          step: SendMessageSteps.meta,
          errors: {},
          setMessage: vi.fn(),
          setPendingFiles: vi.fn(),
          setSearchParams: vi.fn(),
          onStep,
          setErrors: vi.fn(),
          setStep: vi.fn(),
        }}
      >
        <ComposeMessageMeta />
      </SendMessageContext.Provider>,
    )

    expect(await screen.findByText("Ábhar")).toBeInTheDocument()
    expect(screen.getByRole("combobox")).toHaveValue("template-1")
    expect(
      screen.queryByRole("heading", { name: "heading.richText" }),
    ).not.toBeInTheDocument()

    await userEvent.click(
      screen.getByRole("radio", { name: "label.nonSecure" }),
    )
    await userEvent.click(screen.getByRole("button", { name: "button.submit" }))
    expect(onStep).toHaveBeenCalledWith(
      expect.objectContaining({ securityLevel: "public" }),
      "next",
    )
  })
})
