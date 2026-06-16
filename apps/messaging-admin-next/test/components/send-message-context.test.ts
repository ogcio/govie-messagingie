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
})
