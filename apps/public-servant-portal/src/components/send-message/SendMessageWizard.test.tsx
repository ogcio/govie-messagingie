import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SendMessageContext, SendMessageSteps } from "./SendMessageContext"
import { SendMessageWizard } from "./SendMessageWizard"

const { replaceMock, searchParams, setStep } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  searchParams: new URLSearchParams(),
  setStep: vi.fn(),
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
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/messages/new",
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => searchParams,
}))
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock("@ogcio/design-system-react", () => ({
  ProgressStepper: ({
    children,
    currentStepIndex,
  }: React.PropsWithChildren<{ currentStepIndex: number }>) => (
    <ol aria-label='message progress' data-current-step={currentStepIndex}>
      {children}
    </ol>
  ),
  Stack: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  StepItem: ({ label }: { label: string }) => <li>{label}</li>,
}))

function CurrentStep() {
  return <h1>Current form</h1>
}

function renderWizard(
  step = { ...SendMessageSteps.meta, component: CurrentStep },
) {
  return render(
    <SendMessageContext.Provider
      value={{
        userId: "user-1",
        canCreateProfiles: false,
        canUploadFiles: false,
        searchParams: {},
        message: {},
        pendingFiles: [],
        step,
        errors: {},
        setMessage: vi.fn(),
        setPendingFiles: vi.fn(),
        setSearchParams: vi.fn(),
        onStep: vi.fn(),
        setErrors: vi.fn(),
        setStep,
      }}
    >
      <SendMessageWizard />
    </SendMessageContext.Provider>,
  )
}

describe(SendMessageWizard.name, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of [...searchParams.keys()]) searchParams.delete(key)
  })

  it("shows progress and the active step component", () => {
    renderWizard()

    expect(
      screen.getByRole("list", { name: "message progress" }),
    ).toHaveAttribute("data-current-step", "0")
    expect(screen.getByRole("heading", { name: "Current form" })).toBeVisible()
    expect(screen.getAllByRole("listitem")).toHaveLength(5)
  })

  it("honours a recipients deep link and removes it from the URL", async () => {
    searchParams.set("step", "recipients")
    const { container } = renderWizard()

    expect(container).toBeEmptyDOMElement()
    await waitFor(() =>
      expect(setStep).toHaveBeenCalledWith(SendMessageSteps.recipients),
    )
    expect(replaceMock).toHaveBeenCalledWith("/en/messages/new")
  })
})
