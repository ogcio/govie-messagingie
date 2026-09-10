import { describe, expect, it } from "vitest"
import {
  buildAppliedFilter,
  decodeBooleanParam,
  decodeDateParam,
  decodeListParam,
  decodeTextParam,
  encodeBooleanParam,
  encodeDateParam,
  encodeListParam,
  encodeTextParam,
  getMessageEventDisplayLabel,
  getMessageEventTypeLabel,
  isDisplayableMessageEvent,
  MessageStatusEventKey,
} from "./appliedFilter"

describe("list param round-trip", () => {
  it("encodes selected value with statuses", () => {
    expect(
      encodeListParam({
        type: "list",
        selectedValue: "message_delivery",
        failed: true,
        successful: true,
      }),
    ).toBe("message_delivery,failed,successful")
  })

  it("decodes back to the same meta", () => {
    expect(decodeListParam("message_delivery,failed,successful")).toEqual({
      type: "list",
      selectedValue: "message_delivery",
      failed: true,
      successful: true,
    })
  })

  it("throws on an empty value", () => {
    expect(() => decodeListParam("")).toThrow()
  })
})

describe("date param round-trip", () => {
  it.each([
    [
      {
        type: "date",
        dateOption: "between",
        from: "2023-01-01",
        to: "2023-01-31",
      },
      "between,2023-01-01,2023-01-31",
    ],
    [
      { type: "date", dateOption: "from", from: "2023-01-01" },
      "from,2023-01-01",
    ],
    [{ type: "date", dateOption: "to", to: "2023-01-31" }, "to,2023-01-31"],
  ] as const)("encodes %j", (meta, expected) => {
    expect(encodeDateParam(meta as never)).toBe(expected)
  })

  it("encodes empty when no dates are set", () => {
    expect(
      encodeDateParam({ type: "date", dateOption: "between" } as never),
    ).toBe("")
  })

  it("decodes a between range", () => {
    const meta = decodeDateParam("between,2023-01-01,2023-01-31")
    expect(meta.from).toBe("2023-01-01")
    expect(meta.to).toBe("2023-01-31")
  })

  it("throws on an unknown date option", () => {
    expect(() => decodeDateParam("sometime,2023-01-01")).toThrow()
  })
})

describe("boolean param round-trip", () => {
  it("round-trips both statuses", () => {
    const meta = { type: "boolean", failed: true, successful: true } as const
    expect(decodeBooleanParam(encodeBooleanParam(meta))).toEqual(meta)
  })

  it("decodes an empty string as both false", () => {
    expect(decodeBooleanParam("")).toEqual({
      type: "boolean",
      failed: false,
      successful: false,
    })
  })
})

describe("text param round-trip", () => {
  it("round-trips text", () => {
    expect(
      decodeTextParam(encodeTextParam({ type: "text", text: "ada" })),
    ).toEqual({ type: "text", text: "ada" })
  })
})

describe("buildAppliedFilter", () => {
  it("builds a text filter", () => {
    const filter = buildAppliedFilter({
      key: "email",
      keylabel: "Email",
      meta: { type: "text", text: "a@b.ie" },
    })
    expect(filter.value).toBe("a@b.ie")
    expect(filter.urlValue).toBe("a@b.ie")
  })

  it("builds a date filter with a between display value", () => {
    const filter = buildAppliedFilter({
      key: "scheduled_at",
      keylabel: "Scheduled",
      meta: {
        type: "date",
        dateOption: "between",
        from: "2023-01-01",
        to: "2023-01-31",
      },
    })
    expect(filter.value).toBe("between 2023-01-01 and 2023-01-31")
  })

  it("builds a boolean filter with None when no status is set", () => {
    const filter = buildAppliedFilter({
      key: "status_type_email",
      keylabel: "Email Status",
      meta: { type: "boolean", failed: false, successful: false },
    })
    expect(filter.value).toBe("None")
  })

  it("builds a list filter labelled with the event type", () => {
    const filter = buildAppliedFilter({
      key: "status_type_ie",
      keylabel: "Event Type",
      meta: {
        type: "list",
        selectedValue: "message_delivery",
        successful: true,
        failed: false,
      },
    })
    expect(filter.value).toBe("Message delivery (successful)")
  })
})

describe("event type labels", () => {
  it.each([
    ["email_delivery", "Notification email delivery"],
    ["message_delivery", "Message delivery"],
    ["message_option_seen", "Message seen"],
    ["message_option_unseen", "Message unseen"],
    ["message_schedule", "Message schedule"],
    ["message_create", "Internal message process"],
  ] as const)("labels %s as %s", (key, label) => {
    expect(getMessageEventTypeLabel(key)).toBe(label)
  })

  it("suffixes display labels with success/failure", () => {
    expect(getMessageEventDisplayLabel("message_delivery", "successful")).toBe(
      "Message delivery success",
    )
    expect(getMessageEventDisplayLabel("message_delivery", "failed")).toBe(
      "Message delivery failure",
    )
  })

  it("treats only displayable events as displayable", () => {
    expect(
      isDisplayableMessageEvent(MessageStatusEventKey.MESSAGE_DELIVERY),
    ).toBe(true)
    expect(
      isDisplayableMessageEvent(MessageStatusEventKey.MESSAGE_CREATE),
    ).toBe(false)
  })
})
