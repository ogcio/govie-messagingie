import { describe, expect, it } from "vitest"
import { formatDate, formatTime } from "./date"

describe("profile-admin date formatting", () => {
  it("formats valid dates and times in Dublin", () => {
    expect(formatDate("2026-08-27T12:30:00.000Z")).toBe("27/08/2026")
    expect(formatTime("2026-08-27T12:30:00.000Z")).toBe("13:30:00")
  })

  it("rejects missing and invalid dates", () => {
    expect(formatDate(null)).toBeNull()
    expect(formatDate("invalid")).toBeNull()
    expect(formatTime(undefined)).toBeNull()
    expect(formatTime("invalid")).toBeNull()
  })
})
