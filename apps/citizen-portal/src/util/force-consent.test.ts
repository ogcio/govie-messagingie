import { afterEach, beforeEach, describe, expect, it } from "vitest"
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
})
