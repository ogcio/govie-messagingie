import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { NEXT_LOCALE_COOKIE } from "@/const"
import { localeBootstrapScript, readLocaleCookie } from "@/util/locale-cookie"

/**
 * The locale cookie is the cross-app persistence layer for the language
 * preference: written before first paint by the injected bootstrap script,
 * read first by `useLocalePreference`. Scope correctness (shared parent
 * domain) is what lets a choice on messaging.* carry to profile.* /
 * dashboard.*.
 */
function clearCookies() {
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim()
    if (name) {
      // biome-ignore lint/suspicious/noDocumentCookie: test cleanup
      document.cookie = `${name}=; Max-Age=0; path=/`
    }
  }
}

describe("readLocaleCookie", () => {
  beforeEach(clearCookies)
  afterEach(clearCookies)

  it("returns the persisted locale when a supported value is set", () => {
    // biome-ignore lint/suspicious/noDocumentCookie: test setup
    document.cookie = `${NEXT_LOCALE_COOKIE}=ga; path=/`
    expect(readLocaleCookie()).toBe("ga")
  })

  it("returns null when no cookie is set", () => {
    expect(readLocaleCookie()).toBeNull()
  })

  it("returns null for an unsupported cookie value", () => {
    // biome-ignore lint/suspicious/noDocumentCookie: test setup
    document.cookie = `${NEXT_LOCALE_COOKIE}=fr; path=/`
    expect(readLocaleCookie()).toBeNull()
  })
})

describe("localeBootstrapScript", () => {
  it("sets the html lang and persists the locale cookie", () => {
    const script = localeBootstrapScript("ga")
    expect(script).toContain('document.documentElement.lang="ga"')
    expect(script).toContain(`${NEXT_LOCALE_COOKIE}`)
    expect(script).toContain('"="+"ga"')
    // Scopes to a shared parent domain when the host has one.
    expect(script).toContain('p.length>=3?"."+p.slice(1).join(".")')
  })

  it("executing the script writes a readable cookie", () => {
    clearCookies()
    // The bootstrap script is an IIFE; evaluate it against the JSDOM globals
    // (`document` / `location`) to prove it actually persists the cookie.
    // biome-ignore lint/security/noGlobalEval: exercising the injected script
    eval(localeBootstrapScript("en"))
    expect(readLocaleCookie()).toBe("en")
    clearCookies()
  })
})
