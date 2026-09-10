import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SendMessageContext, SendMessageSteps } from "./SendMessageContext"
import SuccessForm from "./SuccessForm"

const { setMessage, setStep, toasterCreate } = vi.hoisted(() => ({
  setMessage: vi.fn(),
  setStep: vi.fn(),
  toasterCreate: vi.fn(),
}))

vi.mock("@ogcio/sag-client/react", () => ({}))
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
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}))
vi.mock("@/components/containers", () => ({
  SuccessBannerContainer: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
}))
vi.mock("@ogcio/design-system-react", () => ({
  Button: ({
    children,
    onClick,
    type = "button",
  }: React.ComponentProps<"button">) => (
    <button type={type} onClick={onClick}>
      {children}
    </button>
  ),
  Heading: ({ children }: React.PropsWithChildren) => <h1>{children}</h1>,
  Link: ({ children, href }: React.ComponentProps<"a">) => (
    <a href={href}>{children}</a>
  ),
  Paragraph: ({ children }: React.PropsWithChildren) => <p>{children}</p>,
  Stack: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SummaryList: ({ children }: React.PropsWithChildren) => <dl>{children}</dl>,
  SummaryListRow: ({
    children,
    label,
  }: React.PropsWithChildren<{ label: string }>) => (
    <div>
      <dt>{label}</dt>
      {children}
    </div>
  ),
  SummaryListValue: ({ children }: React.PropsWithChildren) => (
    <dd>{children}</dd>
  ),
  toaster: { create: toasterCreate },
}))

function renderSuccess(
  successfulMessagesCreated = 2,
  schedule: string | undefined = "2026-08-27T12:00:00.000Z",
  userIds: string[] | undefined = ["profile-1", "profile-2"],
) {
  render(
    <SendMessageContext.Provider
      value={{
        userId: "user-1",
        canCreateProfiles: false,
        canUploadFiles: false,
        searchParams: {},
        message: {
          templateName: "Appointment reminder",
          userIds,
          successfulMessagesCreated,
          schedule,
        },
        pendingFiles: [],
        step: SendMessageSteps.success,
        errors: {},
        setMessage,
        setPendingFiles: vi.fn(),
        setSearchParams: vi.fn(),
        onStep: vi.fn(),
        setErrors: vi.fn(),
        setStep,
      }}
    >
      <SuccessForm />
    </SendMessageContext.Provider>,
  )
}

describe("SuccessForm", () => {
  beforeEach(() => vi.clearAllMocks())

  it("summarises the sent messages and links to their event log", () => {
    renderSuccess()

    expect(screen.getByText("Appointment reminder")).toBeVisible()
    expect(screen.getByText("2")).toBeVisible()
    expect(screen.getByRole("link", { name: "link.eventLog" })).toHaveAttribute(
      "href",
      expect.stringContaining("/en/message-events?dateFrom="),
    )
    expect(toasterCreate).not.toHaveBeenCalled()
  })

  it("warns about partial failure and resets the wizard", async () => {
    renderSuccess(1)

    expect(toasterCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Some messages failed to send.",
        variant: "danger",
      }),
    )
    await userEvent.click(
      screen.getByRole("button", { name: "button.sendAnother" }),
    )

    expect(setMessage).toHaveBeenCalledWith(
      expect.objectContaining({ successfulMessagesCreated: 0, userIds: [] }),
    )
    expect(setStep).toHaveBeenCalledWith(SendMessageSteps.meta)
  })

  it("handles a result without a schedule or recipient count", () => {
    renderSuccess(0, "", undefined)

    expect(screen.getByText("Appointment reminder")).toBeVisible()
    expect(screen.getByRole("link", { name: "link.eventLog" })).toHaveAttribute(
      "href",
      "/en/message-events?dateFrom=undefined&dateTo=undefined",
    )
    expect(toasterCreate).toHaveBeenCalled()
  })
})
