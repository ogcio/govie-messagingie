import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/headers", () => ({
  headers: () => ({
    get: (key: string) => (mockHeaders as Record<string, string>)[key] ?? null,
  }),
}))

import {
  createGetCurrentAbsoluteUrl,
  createGetCurrentPath,
  createGetCurrentSearch,
} from "../current-request"
import type { CustomHeaders } from "../types"

const customHeaders: CustomHeaders = {
  Pathname: "x-pathname",
  Search: "x-search",
}

const mockHeaders: Record<string, string> = {}

describe("current-request", () => {
  beforeEach(() => {
    Object.keys(mockHeaders).forEach((k) => {
      delete mockHeaders[k]
    })
  })

  it("reads current path and search from headers", () => {
    mockHeaders["x-pathname"] = "/p"
    mockHeaders["x-search"] = "?a=1"
    const getCurrentPath = createGetCurrentPath(customHeaders)
    const getCurrentSearch = createGetCurrentSearch(customHeaders)
    expect(getCurrentPath()).toBe("/p")
    expect(getCurrentSearch()).toBe("?a=1")
  })

  it("builds absolute url from base and path", () => {
    mockHeaders["x-pathname"] = "/page"
    const getCurrentAbsoluteUrl = createGetCurrentAbsoluteUrl(customHeaders)
    const url = getCurrentAbsoluteUrl("https://app.example.com")
    expect(String(url)).toContain("https://app.example.com/page")
  })
})
