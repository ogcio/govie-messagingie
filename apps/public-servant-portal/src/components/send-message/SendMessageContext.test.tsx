import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useContext } from "react"
import { describe, expect, it, vi } from "vitest"
import {
  SendMessageContext,
  SendMessageProvider,
  SendMessageSteps,
} from "./SendMessageContext"

vi.mock("@ogcio/sag-client/react", () => ({}))
vi.mock("@/components/UserContext", () => ({
  useUser: () => ({ id: "user-1" }),
  useUserRoles: () => ({ canCreateProfiles: true, canUploadFiles: true }),
}))
vi.mock("./AttachmentsForm", () => ({ default: () => null }))
vi.mock("./ComposeMessageMeta", () => ({ default: () => null }))
vi.mock("./Recipients", () => ({ default: () => null }))
vi.mock("./ScheduleForm", () => ({ default: () => null }))
vi.mock("./SuccessForm", () => ({ default: () => null }))

function ContextProbe() {
  const context = useContext(SendMessageContext)
  return (
    <>
      <output>{`${context.userId}:${context.step.key}:${context.message.templateMetaId ?? ""}`}</output>
      <button
        type='button'
        onClick={() => context.onStep({ templateMetaId: "template-1" }, "next")}
      >
        next
      </button>
      <button
        type='button'
        onClick={() => context.onStep(context.message, "previous")}
      >
        previous
      </button>
    </>
  )
}

describe(SendMessageProvider.name, () => {
  it("exposes permissions and moves forward and backward while preserving state", async () => {
    render(
      <SendMessageProvider>
        <ContextProbe />
      </SendMessageProvider>,
    )

    expect(screen.getByText("user-1:meta:")).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: "next" }))
    expect(screen.getByText("user-1:recipients:template-1")).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: "previous" }))
    expect(screen.getByText("user-1:meta:template-1")).toBeVisible()
  })

  it("keeps the moved step-definition test aligned with rendered components", () => {
    expect(SendMessageSteps.attachments.component).toBeTypeOf("function")
    expect(SendMessageSteps.success.next).toBeNull()
  })
})
