import { describe, expect, it } from "vitest"
import { offsetToPage, pageToOffset } from "@/util/pagination"

describe("offsetToPage", () => {
  it("returns page 1 for the start of the list", () => {
    expect(offsetToPage(0, 20)).toBe(1)
  })

  it("uses defaults when no arguments are provided", () => {
    expect(offsetToPage()).toBe(1)
  })

  it("maps offsets within a page back to the same page", () => {
    expect(offsetToPage(19, 20)).toBe(1)
    expect(offsetToPage(20, 20)).toBe(2)
    expect(offsetToPage(39, 20)).toBe(2)
  })

  it("supports custom page sizes", () => {
    expect(offsetToPage(50, 25)).toBe(3)
    expect(offsetToPage(24, 25)).toBe(1)
  })
})

describe("pageToOffset", () => {
  it("returns 0 for the first page", () => {
    expect(pageToOffset(1, 20)).toBe(0)
  })

  it("uses defaults when no arguments are provided", () => {
    expect(pageToOffset()).toBe(0)
  })

  it("multiplies (page - 1) by the page size", () => {
    expect(pageToOffset(2, 20)).toBe(20)
    expect(pageToOffset(3, 20)).toBe(40)
    expect(pageToOffset(5, 25)).toBe(100)
  })

  it("round-trips with offsetToPage", () => {
    for (const page of [1, 2, 3, 7, 10]) {
      expect(offsetToPage(pageToOffset(page, 20), 20)).toBe(page)
    }
  })
})
