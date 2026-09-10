import { describe, expect, it } from "vitest"
import { pagingMeta } from "@/util/api-paths"
import { url } from "@/util/url"

describe("url", () => {
  it("builds send-a-message home path", () => {
    expect(url("en").home).toBe("/en/send-a-message")
  })

  it("builds template edit path with id", () => {
    expect(url("en").messageTemplates.template("abc")).toBe(
      "/en/message-templates/template?id=abc",
    )
  })

  it("builds event detail path with search", () => {
    expect(url("ga").messageEvents.detail("evt-1", "search=foo")).toBe(
      "/ga/message-events/detail?eventId=evt-1&search=foo",
    )
  })
})

describe("pagingMeta", () => {
  it("computes total pages and clamps current page", () => {
    expect(pagingMeta(45, 0, 20)).toEqual({ totalPages: 3, currentPage: 0 })
    expect(pagingMeta(45, 5, 20)).toEqual({ totalPages: 3, currentPage: 2 })
  })
})
