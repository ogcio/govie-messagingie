import { describe, expect, it } from "vitest"
import {
  buildSubmissionDetailUrl,
  buildSubmissionsUrl,
  computeTotalPages,
  parseSubmissionPageSize,
} from "./pagination-utils"

describe("submission pagination", () => {
  it.each([
    ["5", 5],
    ["20", 20],
    ["7", 10],
    [null, 10],
  ])("parses page size %s", (value, expected) => {
    expect(parseSubmissionPageSize(value)).toBe(expected)
  })

  it("builds list URLs with explicit pagination and search", () => {
    expect(
      buildSubmissionsUrl({ search: "housing", page: 2, pageSize: 5 }),
    ).toBe(
      "/journey-builder/api/v1/external/user-submissions?limit=5&offset=5&search=housing",
    )
  })

  it("uses defaults and omits an empty search", () => {
    expect(buildSubmissionsUrl({ search: null, page: 1 })).toBe(
      "/journey-builder/api/v1/external/user-submissions?limit=10&offset=0",
    )
    expect(computeTotalPages(21)).toBe(3)
    expect(computeTotalPages(21, 5)).toBe(5)
  })

  it("builds detail URLs", () => {
    expect(buildSubmissionDetailUrl("submission-1")).toBe(
      "/journey-builder/api/v1/external/user-submissions/submission-1",
    )
  })
})
