import { describe, expect, it } from "vitest"
import {
  DEFAULT_PAGE_SIZE,
  parsePageSize,
} from "@/components/messages/page-size"

describe("parsePageSize", () => {
  it("returns the default when limit is absent", () => {
    expect(parsePageSize(null)).toBe(DEFAULT_PAGE_SIZE)
  })

  it("returns a valid configured page size", () => {
    expect(parsePageSize("20")).toBe(20)
  })

  it("falls back to the default for invalid values", () => {
    expect(parsePageSize("7")).toBe(DEFAULT_PAGE_SIZE)
    expect(parsePageSize("abc")).toBe(DEFAULT_PAGE_SIZE)
  })
})
