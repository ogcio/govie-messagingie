import { describe, expect, it } from "vitest"
import { parseTab } from "@/components/messages/parse-tab"

describe("parseTab", () => {
  it('returns "all" when value is "all"', () => {
    expect(parseTab("all")).toBe("all")
  })

  it('returns "unread" when value is "unread"', () => {
    expect(parseTab("unread")).toBe("unread")
  })

  it('defaults to "unread" when value is null', () => {
    expect(parseTab(null)).toBe("unread")
  })

  it('defaults to "unread" when value is undefined', () => {
    expect(parseTab(undefined)).toBe("unread")
  })

  it('defaults to "unread" for unknown values', () => {
    expect(parseTab("invalid")).toBe("unread")
    expect(parseTab("")).toBe("unread")
    expect(parseTab("ALL")).toBe("unread")
  })
})
