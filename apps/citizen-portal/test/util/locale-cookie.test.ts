import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { NEXT_LOCALE_COOKIE } from "@/const"
import { readLocaleCookie, writeLocaleCookie } from "@/util/locale-cookie"

/**
 * The locale cookie is the cross-app persistence layer for the language
 * preference: written on every localised render, read first by
 * `useLocalePreference`. Scope correctness (shared parent domain) is what
 * lets a choice on messaging.* carry to profile.* / dashboard.*.
 */
function setHostname(hostname: string, protocol = "https:") {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { hostname, protocol },
  })
}

function clearCookies() {
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim()
    if (name) {
      // biome-ignore lint/suspicious/noDocumentCookie: test cleanup
      document.cookie = `${name}=; Max-Age=0; path=/`
    }
  }
}

const originalLocation = Object.getOwnPropertyDescriptor(window, "location")

describe("locale-cookie", () => {
  beforeEach(() => {
    clearCookies()
    setHostname("localhost", "http:")
  })

  afterEach(() => {
    clearCookies()
    if (originalLocation) {
      Object.defineProperty(window, "location", originalLocation)
    }
  })

  it("round-trips a supported locale", () => {
    writeLocaleCookie("ga")
    expect(readLocaleCookie()).toBe("ga")
    writeLocaleCookie("en")
    expect(readLocaleCookie()).toBe("en")
  })

  it("returns null when no cookie is set", () => {
    expect(readLocaleCookie()).toBeNull()
  })

  it("returns null for an unsupported cookie value", () => {
    // biome-ignore lint/suspicious/noDocumentCookie: test setup
    document.cookie = `${NEXT_LOCALE_COOKIE}=fr; path=/`
    expect(readLocaleCookie()).toBeNull()
  })

  it("writes a host-only cookie on localhost (no shared parent domain)", () => {
    setHostname("localhost", "http:")
    writeLocaleCookie("ga")
    // JSDOM does not surface the Domain attribute, but the value must be
    // written and readable back on a host without a shared parent.
    expect(document.cookie).toContain(`${NEXT_LOCALE_COOKIE}=ga`)
  })

  it("persists the value for a shared parent domain host", () => {
    setHostname("messaging.uat.services.gov.ie")
    writeLocaleCookie("ga")
    expect(readLocaleCookie()).toBe("ga")
  })
})
