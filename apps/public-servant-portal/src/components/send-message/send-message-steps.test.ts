import { describe, expect, it } from "vitest"
import { SendMessageStepDefinitions } from "@/components/send-message/send-message-steps"

describe("SendMessageSteps", () => {
  it("defines a linear wizard progression", () => {
    expect(SendMessageStepDefinitions.meta.next).toBe("recipients")
    expect(SendMessageStepDefinitions.recipients.next).toBe("attachments")
    expect(SendMessageStepDefinitions.attachments.next).toBe("schedule")
    expect(SendMessageStepDefinitions.schedule.next).toBe("success")
    expect(SendMessageStepDefinitions.success.next).toBeNull()
  })

  it("validates schedule step requires schedule value", () => {
    expect(
      SendMessageStepDefinitions.schedule.isValid({ schedule: "2026-01-01" }),
    ).toBe(true)
    expect(SendMessageStepDefinitions.schedule.isValid({})).toBe(false)
  })

  it("validates each wizard step", () => {
    expect(
      SendMessageStepDefinitions.meta.isValid({ templateMetaId: "1" }),
    ).toBe(true)
    expect(SendMessageStepDefinitions.meta.isValid({})).toBe(false)
    expect(
      SendMessageStepDefinitions.recipients.isValid({ userIds: ["1"] }),
    ).toBe(true)
    expect(SendMessageStepDefinitions.recipients.isValid({ userIds: [] })).toBe(
      false,
    )
    expect(SendMessageStepDefinitions.attachments.isValid({})).toBe(true)
    expect(SendMessageStepDefinitions.success.isValid({})).toBe(true)
  })
})
