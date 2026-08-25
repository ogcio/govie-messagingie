import { describe, expect, it } from "vitest"
import {
  extractMessageMeta,
  extractScheduledAt,
  type MessageEventDetailItem,
} from "@/util/message-event-meta"

const event = (
  data: MessageEventDetailItem["data"],
): MessageEventDetailItem => ({
  messageId: "msg-1",
  eventType: "message_create",
  eventStatus: "successful",
  createdAt: "2026-06-15T12:00:00Z",
  data,
})

/**
 * Regression cover for AB#37462 commit 2a234b6:
 * `useGatewayFetch` already unwraps `{ data: events[] }` from the messaging
 * API, so the detail page must read the recipient/subject from the FIRST
 * event whose `data` carries `receiverFullName` — not from a non-existent
 * top-level `data.messageEvents.data` path.
 */
describe("extractMessageMeta", () => {
  it("returns empty strings when the list is undefined or empty", () => {
    expect(extractMessageMeta(undefined)).toEqual({ recipient: "", subject: "" })
    expect(extractMessageMeta([])).toEqual({ recipient: "", subject: "" })
  })

  it("extracts recipient and subject from the first event that has receiverFullName", () => {
    const result = extractMessageMeta([
      event({ status: "queued" }),
      event({ receiverFullName: "Alice Wayne", subject: "Hello" }),
      event({ receiverFullName: "Bob Stark", subject: "Ignored" }),
    ])
    expect(result).toEqual({ recipient: "Alice Wayne", subject: "Hello" })
  })

  it("falls back to empty strings when receiverFullName/subject are nullish", () => {
    expect(
      extractMessageMeta([
        event({ receiverFullName: null, subject: undefined }),
      ]),
    ).toEqual({ recipient: "", subject: "" })
  })

  it("returns empty strings when no event carries receiverFullName", () => {
    expect(
      extractMessageMeta([
        event({ status: "delivered" }),
        event({ status: "opened" }),
      ]),
    ).toEqual({ recipient: "", subject: "" })
  })

  it("coerces non-string receiverFullName/subject values to strings", () => {
    const result = extractMessageMeta([
      event({ receiverFullName: 42, subject: { id: 1 } }),
    ])
    expect(result.recipient).toBe("42")
    expect(typeof result.subject).toBe("string")
  })
})

describe("extractScheduledAt", () => {
  it("returns undefined when the list is undefined or empty", () => {
    expect(extractScheduledAt(undefined)).toBeUndefined()
    expect(extractScheduledAt([])).toBeUndefined()
  })

  it("returns the scheduledAt carried by the message_create event", () => {
    expect(
      extractScheduledAt([
        event({ status: "queued" }),
        event({
          receiverFullName: "Alice Wayne",
          scheduledAt: "2026-05-08T09:30:00+01:00",
        }),
      ]),
    ).toBe("2026-05-08T09:30:00+01:00")
  })

  it("ignores empty or non-string scheduledAt values", () => {
    expect(
      extractScheduledAt([
        event({ scheduledAt: "" }),
        event({ scheduledAt: 12345 }),
      ]),
    ).toBeUndefined()
  })
})
