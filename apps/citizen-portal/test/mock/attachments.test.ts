import { describe, expect, it, vi } from "vitest"

vi.mock("@/mock/messages", () => ({
  MOCK_MESSAGES_ENABLED: true,
}))

import {
  getMockAttachmentIds,
  getMockAttachmentMetadata,
  toMockAttachmentId,
} from "@/mock/attachments"

describe("mock attachments", () => {
  it("derives a UUID attachment id from a message id", () => {
    expect(toMockAttachmentId("00000001-0000-4000-8000-000000000001")).toBe(
      "10000001-0000-4000-8000-000000000001",
    )
  })

  it("returns attachment ids from message fixtures", () => {
    expect(
      getMockAttachmentIds({
        id: "0000000a-0000-4000-8000-00000000000a",
        attachments: ["1000000a-0000-4000-8000-00000000000a"],
        attachmentsCount: 1,
      }),
    ).toEqual(["1000000a-0000-4000-8000-00000000000a"])
  })

  it("builds metadata for mock attachment UUIDs", () => {
    const metadata = getMockAttachmentMetadata(
      "10000001-0000-4000-8000-000000000001",
      {
        subject: "Please find attached your payslip for the month of August.",
        createdAt: "2025-08-30T09:00:00Z",
      },
    )

    expect(metadata).toMatchObject({
      id: "10000001-0000-4000-8000-000000000001",
      fileName: "Payslip - August.pdf",
      mimeType: "application/pdf",
    })
  })

  it("rejects non-mock attachment ids", () => {
    expect(
      getMockAttachmentMetadata("mock-att-msg-1", {
        subject: "Test",
        createdAt: "2025-01-01T00:00:00Z",
      }),
    ).toBeNull()
  })
})
