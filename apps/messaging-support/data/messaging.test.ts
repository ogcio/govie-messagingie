import dayjs from "dayjs"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { MessageQueryRow } from "./types"

vi.mock("@ogcio/o11y-sdk-node", () => ({
  withSpan: ({ fn }: { fn: (span: unknown) => unknown }) =>
    fn({ recordException: vi.fn(), setAttribute: vi.fn() }),
}))

const queryMock = vi.fn()
vi.mock("./pg", () => ({
  messagePool: { query: (...args: unknown[]) => queryMock(...args) },
  profilePool: { query: vi.fn() },
}))

const { getMessages } = await import("./messaging")

function row(overrides: Partial<MessageQueryRow> = {}): MessageQueryRow {
  return {
    id: "msg-1",
    scheduled_at: "2025-06-15T10:30:00Z",
    subject: "A subject",
    organisation_id: "org-1",
    status: [
      { type: "email_delivery", status: "successful" },
      { type: "message_delivery", status: "failed" },
    ],
    ...overrides,
  }
}

beforeEach(() => {
  queryMock.mockReset()
})

describe("getMessages", () => {
  it("queries with sorted profile ids and no filter clause", async () => {
    queryMock.mockResolvedValue({ rows: [row()] })

    const result = await getMessages(["b", "a"], {})

    expect(result.success).toBe(true)
    const [sql, values] = queryMock.mock.calls[0]
    expect(sql).toContain("WHERE TRUE")
    expect(values).toEqual([["a", "b"]])
  })

  it("maps rows to table messages with display labels", async () => {
    queryMock.mockResolvedValue({ rows: [row()] })

    const result = await getMessages(["a"], {})

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value).toEqual([
      {
        id: "msg-1",
        emailEventType: "Notification email delivery success",
        emailEventStatus: "successful",
        messagingEventType: "Message delivery failure",
        messagingEventStatus: "failed",
        orgId: "org-1",
        // formatted in the runner's local timezone, so compute it the same way
        scheduledAt: dayjs("2025-06-15T10:30:00Z").format("DD MMM YYYY, HH:mm"),
        subject: "A subject",
      },
    ])
  })

  it("leaves event fields empty when the row has no matching events", async () => {
    queryMock.mockResolvedValue({ rows: [row({ status: [] })] })

    const result = await getMessages(["a"], {})

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value[0].emailEventType).toBe("")
    expect(result.value[0].messagingEventType).toBe("")
  })

  it("builds a date where clause from scheduled_at search params", async () => {
    queryMock.mockResolvedValue({ rows: [] })

    await getMessages(["a"], {
      scheduled_at: "between,2025-01-01,2025-01-31",
    })

    const [sql, values] = queryMock.mock.calls[0]
    expect(sql).toContain(
      "scheduled_at >= $2::date AND scheduled_at <= $3::date",
    )
    expect(values).toEqual([["a"], "2025-01-01", "2025-01-31"])
  })

  it("builds a from-only date clause", async () => {
    queryMock.mockResolvedValue({ rows: [] })

    await getMessages(["a"], { scheduled_at: "from,2025-01-01" })

    const [sql, values] = queryMock.mock.calls[0]
    expect(sql).toContain("scheduled_at >= $2")
    expect(values).toEqual([["a"], "2025-01-01"])
  })

  it("builds a list clause per required status for status_type_ie", async () => {
    queryMock.mockResolvedValue({ rows: [] })

    await getMessages(["a"], {
      status_type_ie: "message_delivery,successful,failed",
    })

    const [sql, values] = queryMock.mock.calls[0]
    expect(sql).toContain("s_obj.item->>'type' = $2")
    expect(sql).toContain("s_obj.item->>'status' = $3")
    expect(sql).toContain("s_obj.item->>'type' = $4")
    expect(values).toEqual([
      ["a"],
      "message_delivery",
      "successful",
      "message_delivery",
      "failed",
    ])
  })

  it("skips a status_type_ie filter with no statuses selected", async () => {
    queryMock.mockResolvedValue({ rows: [] })

    await getMessages(["a"], { status_type_ie: "message_delivery" })

    const [sql] = queryMock.mock.calls[0]
    expect(sql).toContain("WHERE TRUE")
  })

  it("builds a NOT EXISTS clause for an email boolean filter with no statuses", async () => {
    queryMock.mockResolvedValue({ rows: [] })

    await getMessages(["a"], { status_type_email: "" })

    const [sql] = queryMock.mock.calls[0]
    expect(sql).toContain("NOT EXISTS")
    expect(sql).toContain("'email_delivery'")
  })

  it("builds an exists clause per status for an email boolean filter", async () => {
    queryMock.mockResolvedValue({ rows: [] })

    await getMessages(["a"], { status_type_email: "successful,failed" })

    const [sql, values] = queryMock.mock.calls[0]
    expect(sql).toContain("s_obj.item->>'status' = $2")
    expect(sql).toContain("s_obj.item->>'status' = $3")
    expect(values).toEqual([["a"], "successful", "failed"])
  })

  it("combines date and list clauses with AND", async () => {
    queryMock.mockResolvedValue({ rows: [] })

    await getMessages(["a"], {
      scheduled_at: "to,2025-02-01",
      status_type_ie: "message_delivery,successful",
    })

    const [sql] = queryMock.mock.calls[0]
    expect(sql).toMatch(
      /scheduled_at <= \$2[\s\S]*AND[\s\S]*s_obj\.item->>'type' = \$3/,
    )
  })

  it("ignores unknown search params", async () => {
    queryMock.mockResolvedValue({ rows: [] })

    await getMessages(["a"], { not_a_filter: "x" })

    const [sql, values] = queryMock.mock.calls[0]
    expect(sql).toContain("WHERE TRUE")
    expect(values).toEqual([["a"]])
  })

  it("returns a failure when a search param cannot be decoded", async () => {
    const result = await getMessages(["a"], { scheduled_at: "junk" })

    expect(result.success).toBe(false)
    expect(queryMock).not.toHaveBeenCalled()
  })

  it("returns a failure when the query throws", async () => {
    queryMock.mockRejectedValue(new Error("pg down"))

    const result = await getMessages(["a"], {})

    expect(result.success).toBe(false)
  })
})
