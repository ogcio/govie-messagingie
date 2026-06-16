import { describe, expect, it } from "vitest"
import { stringToAsterisk } from "@/util/strings"

/**
 * `stringToAsterisk` produces masking placeholders for sensitive
 * profile fields. The PPSN field gets a fixed 7-char mask so the
 * rendered SummaryListValue width doesn't leak the real PPSN
 * length (which is always 7-8 chars, with a single-letter check
 * digit — a 7-char mask is the safe lower bound).
 */
describe("stringToAsterisk", () => {
  it("returns a 7-char mask for the ppsn field — fixed-length is intentional", () => {
    expect(stringToAsterisk("ppsn")).toBe("*******")
    expect(stringToAsterisk("ppsn").length).toBe(7)
  })

  it("returns the generic 4-char mask for unknown field types", () => {
    expect(stringToAsterisk("anything-else")).toBe("****")
    expect(stringToAsterisk("")).toBe("****")
    expect(stringToAsterisk("PPSN")).toBe("****") // case-sensitive
  })
})
