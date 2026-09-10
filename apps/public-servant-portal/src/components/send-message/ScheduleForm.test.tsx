import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ScheduleForm from "./ScheduleForm"
import { SendMessageContext, SendMessageSteps } from "./SendMessageContext"

const { createMessages, onStep, toasterCreate } = vi.hoisted(() => ({
  createMessages: vi.fn(),
  onStep: vi.fn(),
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
  useTranslations: () => (key: string) => key,
}))
vi.mock("@/hooks/use-create-messages", () => ({
  useCreateMessages: () => createMessages,
}))
vi.mock("@/components/BackButton", () => ({
  BackButton: ({ children, onClick }: React.ComponentProps<"button">) => (
    <button type='button' onClick={onClick}>
      {children}
    </button>
  ),
}))
vi.mock("@ogcio/design-system-react", () => ({
  Button: ({
    children,
    disabled,
    onClick,
    type = "button",
  }: React.ComponentProps<"button">) => (
    <button type={type} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  FormField: ({
    children,
    error,
    label,
  }: React.PropsWithChildren<{
    error?: { text: string }
    label: { text: string; htmlFor: string }
  }>) => (
    <div>
      <label htmlFor={label.htmlFor}>{label.text}</label>
      {children}
      {error && <span role='alert'>{error.text}</span>}
    </div>
  ),
  Heading: ({ children }: React.PropsWithChildren) => <h1>{children}</h1>,
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
  Spinner: () => <span role='status' />,
  Stack: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TextInput: (props: React.ComponentProps<"input">) => <input {...props} />,
  toaster: { create: toasterCreate },
}))

function renderSchedule(
  message: React.ContextType<typeof SendMessageContext>["message"] = {
    templateMetaId: "template-1",
    userIds: ["profile-1"],
    securityLevel: "confidential",
  },
) {
  render(
    <SendMessageContext.Provider
      value={{
        userId: "user-1",
        canCreateProfiles: false,
        canUploadFiles: false,
        searchParams: {},
        message,
        pendingFiles: [],
        step: SendMessageSteps.schedule,
        errors: {},
        setMessage: vi.fn(),
        setPendingFiles: vi.fn(),
        setSearchParams: vi.fn(),
        onStep,
        setErrors: vi.fn(),
        setStep: vi.fn(),
      }}
    >
      <ScheduleForm />
    </SendMessageContext.Provider>,
  )
}

describe(ScheduleForm.name, () => {
  beforeEach(() => vi.clearAllMocks())

  it("requires a date before scheduling for later", async () => {
    renderSchedule()

    await userEvent.click(screen.getByRole("radio", { name: "label.later" }))
    await userEvent.click(screen.getByRole("button", { name: "button.submit" }))

    expect(screen.getByRole("alert")).toHaveTextContent("input.error.date")
    expect(createMessages).not.toHaveBeenCalled()
  })

  it("creates an immediate message and advances to success", async () => {
    createMessages.mockResolvedValue({
      created: 1,
      errors: {},
      schedule: "2026-08-27T12:00:00.000Z",
    })
    renderSchedule()

    await userEvent.click(screen.getByRole("button", { name: "button.submit" }))

    expect(createMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        templateMetaId: "template-1",
        userIds: ["profile-1"],
        pendingFiles: [],
      }),
    )
    expect(onStep).toHaveBeenCalledWith(
      expect.objectContaining({ successfulMessagesCreated: 1 }),
      "next",
    )
  })

  it("requires a time before scheduling for later and clears the error", async () => {
    renderSchedule()
    await userEvent.click(screen.getByRole("radio", { name: "label.later" }))
    await userEvent.type(screen.getByLabelText("Date"), "2026-09-01")
    await userEvent.click(screen.getByRole("button", { name: "button.submit" }))

    expect(screen.getByRole("alert")).toHaveTextContent("input.error.time")
    await userEvent.type(screen.getByLabelText("Time"), "12:30")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("creates a message scheduled for later", async () => {
    createMessages.mockResolvedValue({
      created: 1,
      errors: {},
      schedule: "2026-09-01T12:30:00.000Z",
    })
    renderSchedule()
    await userEvent.click(screen.getByRole("radio", { name: "label.later" }))
    await userEvent.type(screen.getByLabelText("Date"), "2026-09-01")
    await userEvent.type(screen.getByLabelText("Time"), "12:30")

    await userEvent.click(screen.getByRole("button", { name: "button.submit" }))

    expect(createMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        schedule: expect.stringContaining("2026-09-01"),
      }),
    )
  })

  it("shows an error when every message creation fails", async () => {
    createMessages.mockResolvedValue({
      created: 0,
      errors: { "profile-1": "failed" },
    })
    renderSchedule()

    await userEvent.click(screen.getByRole("button", { name: "button.submit" }))

    expect(toasterCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "toaster.title.serverError" }),
    )
    expect(onStep).not.toHaveBeenCalled()
  })

  it("does not submit incomplete message state", async () => {
    renderSchedule({})

    await userEvent.click(screen.getByRole("button", { name: "button.submit" }))

    expect(createMessages).not.toHaveBeenCalled()
  })

  it("returns to the previous step", async () => {
    renderSchedule()

    await userEvent.click(screen.getByRole("button", { name: "button.back" }))

    expect(onStep).toHaveBeenCalledWith(
      expect.objectContaining({ templateMetaId: "template-1" }),
      "previous",
    )
  })
})
