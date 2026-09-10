import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  trigger: vi.fn(),
  replace: vi.fn(),
  pushLog: vi.fn(),
  createToast: vi.fn(),
  withFaroSpan: vi.fn(
    async (
      _name: string,
      _attributes: Record<string, string>,
      callback: () => Promise<void>,
    ) => callback(),
  ),
  isLoading: false,
}))

vi.mock("@ogcio/design-system-react", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type='button' {...props}>
      {children}
    </button>
  ),
  toaster: { create: mocks.createToast },
}))
vi.mock("@/components/css-spinner", () => ({
  CssSpinner: () => <span aria-label='loading' />,
}))
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/secure-messages",
  useRouter: () => ({ replace: mocks.replace }),
}))
vi.mock("@ogcio/sag-client/react", () => ({
  useGatewayMutation: () => ({
    trigger: mocks.trigger,
    isLoading: mocks.isLoading,
  }),
}))
vi.mock("@grafana/faro-web-sdk", () => ({
  faro: { api: { pushLog: mocks.pushLog } },
  LogLevel: { ERROR: "error" },
}))
vi.mock("@/util/trace-helpers", () => ({
  withFaroSpan: mocks.withFaroSpan,
}))
vi.mock("@/const/traces", () => ({
  TRACES: { CONFIRM_ACCOUNT_LINKING: "confirm-account-linking" },
  TRACE_MESSAGES: {
    CONFIRM_ACCOUNT_LINKING: {
      SUCCESS: "linking-success",
      ERROR: "linking-error",
    },
  },
}))

import { ConfirmButton } from "./confirm-button"

const props = {
  currentUserId: "current-id",
  targetUserId: "target-id",
  messageId: "message-id",
}

describe("ConfirmButton", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isLoading = false
    mocks.trigger.mockResolvedValue({ preferredLanguage: "ga" })
  })

  it("links the profile and routes using the returned preferred language", async () => {
    render(<ConfirmButton {...props} />)
    fireEvent.click(screen.getByRole("button", { name: "confirm" }))

    await waitFor(() => {
      expect(mocks.trigger).toHaveBeenCalledWith({
        primaryUserId: "current-id",
      })
    })
    expect(mocks.withFaroSpan).toHaveBeenCalledWith(
      "confirm-account-linking",
      props,
      expect.any(Function),
    )
    expect(mocks.pushLog).toHaveBeenCalledWith(["linking-success"], {
      context: props,
    })
    expect(mocks.replace).toHaveBeenCalledWith(
      "/ga/messages?id=message-id",
    )
  })

  it("logs and shows a toast when linking fails", async () => {
    const error = new Error("gateway unavailable")
    mocks.trigger.mockRejectedValue(error)
    render(<ConfirmButton {...props} />)

    fireEvent.click(screen.getByRole("button", { name: "confirm" }))

    await waitFor(() => {
      expect(mocks.createToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "error.linking",
          description: "error.server",
          variant: "danger",
        }),
      )
    })
    // Args are String()'d by Faro, so only the message belongs there — ids and
    // the error go in `context`, and the level in `options`, or the record is
    // `[object Object]` at level "log".
    expect(mocks.pushLog).toHaveBeenCalledWith(["linking-error"], {
      level: "error",
      context: { ...props, error: error.message },
    })
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it("disables the action and shows progress while linking", () => {
    mocks.isLoading = true
    render(<ConfirmButton {...props} />)

    expect(screen.getByRole("button", { name: /confirm/ })).toBeDisabled()
    expect(screen.getByLabelText("loading")).toBeInTheDocument()
  })
})
