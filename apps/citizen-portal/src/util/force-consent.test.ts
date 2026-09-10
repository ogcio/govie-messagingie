import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearPersistedForceConsent,
  FORCE_CONSENT_SESSION_KEY,
  persistForceConsentFromUrl,
  withForceConsent,
} from "./force-consent"

const FORCE_CONSENT_PARAM = "force-consent"

describe("force-consent persistence", () => {
  beforeEach(() => {
    sessionStorage.clear()
    window.history.replaceState({}, "", "/en/messages")
  })

  afterEach(() => {
    sessionStorage.clear()
    vi.unstubAllGlobals()
  })

  it("stores session flag when force-consent is in the URL", () => {
    window.history.replaceState({}, "", `/en/messages?${FORCE_CONSENT_PARAM}=1`)

    persistForceConsentFromUrl()

    expect(sessionStorage.getItem(FORCE_CONSENT_SESSION_KEY)).toBe("1")
  })

  it("restores force-consent on the URL from session storage", () => {
    sessionStorage.setItem(FORCE_CONSENT_SESSION_KEY, "1")
    window.history.replaceState({}, "", "/en/messages")

    persistForceConsentFromUrl()

    expect(window.location.search).toBe(`?${FORCE_CONSENT_PARAM}=1`)
  })

  it("appends persisted force-consent to a landing path", () => {
    sessionStorage.setItem(FORCE_CONSENT_SESSION_KEY, "1")

    expect(withForceConsent("/en/messages")).toBe(
      `/en/messages?${FORCE_CONSENT_PARAM}=1`,
    )
  })

  it("clears persisted force-consent", () => {
    sessionStorage.setItem(FORCE_CONSENT_SESSION_KEY, "1")

    clearPersistedForceConsent()

    expect(sessionStorage.getItem(FORCE_CONSENT_SESSION_KEY)).toBeNull()
  })

  it("leaves URLs alone without force-consent context", () => {
    persistForceConsentFromUrl()

    expect(window.location.href.endsWith("/en/messages")).toBe(true)
    expect(withForceConsent("/en/messages")).toBe("/en/messages")
  })

  it("preserves the current query and hash on landing paths", () => {
    window.history.replaceState(
      {},
      "",
      `/en/messages?${FORCE_CONSENT_PARAM}=1&message=one#details`,
    )

    expect(withForceConsent("/en/messages")).toBe(
      `/en/messages?${FORCE_CONSENT_PARAM}=1&message=one#details`,
    )
  })

  it("is safe outside the browser", () => {
    vi.stubGlobal("window", undefined)

    expect(persistForceConsentFromUrl()).toBeUndefined()
    expect(withForceConsent("/en/messages")).toBe("/en/messages")
    expect(clearPersistedForceConsent()).toBeUndefined()
  })
})
