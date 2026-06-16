import { describe, expect, it } from "vitest"
import {
  EVENT_STATUSES,
  getInterpolationValues,
  isStatus,
} from "@/util/messaging"

describe("getInterpolationValues", () => {
  it("returns an empty array when no placeholders are present", () => {
    expect(getInterpolationValues("Hello world")).toEqual([])
  })

  it("extracts a single placeholder", () => {
    expect(getInterpolationValues("Hello {{name}}")).toEqual(["name"])
  })

  it("extracts multiple placeholders in order", () => {
    expect(
      getInterpolationValues("Hello {{firstName}} {{lastName}}, your PPSN is {{ppsn}}"),
    ).toEqual(["firstName", "lastName", "ppsn"])
  })

  it("returns an empty array for an empty string", () => {
    expect(getInterpolationValues("")).toEqual([])
  })
})

describe("isStatus", () => {
  it.each(EVENT_STATUSES)("accepts the known status %s", (status) => {
    expect(isStatus(status)).toBe(true)
  })

  it("rejects unknown strings", () => {
    expect(isStatus("unknown")).toBe(false)
    expect(isStatus("")).toBe(false)
    expect(isStatus("DELIVERED")).toBe(false)
  })

  it("rejects non-string inputs", () => {
    expect(isStatus(undefined)).toBe(false)
    expect(isStatus(null)).toBe(false)
    expect(isStatus(0)).toBe(false)
    expect(isStatus({ status: "delivered" })).toBe(false)
  })
})
