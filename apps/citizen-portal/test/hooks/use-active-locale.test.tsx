import { renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NEXT_LOCALE_COOKIE } from "@/const"
import { localeFromPathname, useActiveLocale } from "@/hooks/use-active-locale"

let mockPathname = "/en/messages"

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}))

vi.mock("next-intl", () => ({
  useLocale: () => "en",
}))

function clearLocaleCookie() {
  // biome-ignore lint/suspicious/noDocumentCookie: test cleanup
  document.cookie = `${NEXT_LOCALE_COOKIE}=; Max-Age=0; path=/`
}

describe("localeFromPathname", () => {
  it("reads supported locales from the first path segment", () => {
    expect(localeFromPathname("/ga/messages")).toBe("ga")
    expect(localeFromPathname("/en/my-profile")).toBe("en")
    expect(localeFromPathname("/onboarding")).toBeNull()
  })
})

describe("useActiveLocale", () => {
  beforeEach(() => {
    clearLocaleCookie()
    mockPathname = "/en/messages"
  })

  afterEach(() => clearLocaleCookie())

  it("prefers the URL path over a stale next-intl locale", () => {
    mockPathname = "/ga/messages"
    const { result } = renderHook(() => useActiveLocale())
    expect(result.current).toBe("ga")
  })

  it("falls back to the persisted cookie on locale-less paths", () => {
    mockPathname = "/onboarding"
    // biome-ignore lint/suspicious/noDocumentCookie: test setup
    document.cookie = `${NEXT_LOCALE_COOKIE}=ga; path=/`
    const { result } = renderHook(() => useActiveLocale())
    expect(result.current).toBe("ga")
  })
})
