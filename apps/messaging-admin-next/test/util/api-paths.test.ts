import { describe, expect, it } from "vitest"
import { messagingApi } from "@/util/api-paths"

describe("messagingApi", () => {
  it("builds templates list path", () => {
    expect(messagingApi.templates({ search: "foo" })).toBe(
      "/messaging/api/v1/templates?search=foo&limit=100",
    )
  })

  it("builds message events path with pagination", () => {
    const path = messagingApi.messageEvents({
      search: "bar",
      page: 1,
      size: 10,
      status: "delivered",
    })
    expect(path).toContain("/messaging/api/v1/message-events?")
    expect(path).toContain("search=bar")
    expect(path).toContain("limit=10")
    expect(path).toContain("offset=10")
    expect(path).toContain("status=delivered")
  })
})
