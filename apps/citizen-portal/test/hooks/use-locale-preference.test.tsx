import { renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { matchLocale, useLocalePreference } from "@/hooks/use-locale-preference"

/**
 * `useLocalePreference` drives the locale-landing redirect on
 * `[locale]/page.tsx` and `app/page.tsx` — it picks `en` vs `ga`
 * from the browser language stack before the SSR bounce. A wrong
 * pick here bounces the user to the wrong language and a manual
 * locale switch costs them a full reload.
 *
 * `matchLocale` (the pure half) is locked down per BCP-47 expectation;
 * the hook half is exercised through JSDOM's `navigator` shape and
 * the `languagechange` event.
 */
describe("matchLocale", () => {
  it("returns 'en' for a single English preference", () => {
    expect(matchLocale(["en"])).toBe("en")
    expect(matchLocale(["en-US"])).toBe("en")
    expect(matchLocale(["en-GB"])).toBe("en")
  })

  it("returns 'ga' for a single Irish preference", () => {
    expect(matchLocale(["ga"])).toBe("ga")
    expect(matchLocale(["ga-IE"])).toBe("ga")
  })

  it("picks the first preference that matches a supported locale", () => {
    // The user's first preference is fr (unsupported) → French
    // gets skipped, ga gets matched.
    expect(matchLocale(["fr", "ga"])).toBe("ga")
    expect(matchLocale(["fr-CA", "en-US"])).toBe("en")
  })

  it("falls back to the default locale when nothing matches", () => {
    // The default locale is 'en' (per @/const/locale.ts). Pinning this
    // catches any future "default locale flip" without a corresponding
    // story update.
    expect(matchLocale([])).toBe("en")
    expect(matchLocale(["fr", "de", "es"])).toBe("en")
  })
})

describe("useLocalePreference", () => {
  const originalLanguages = Object.getOwnPropertyDescriptor(
    Navigator.prototype,
    "languages",
  )
  const originalLanguage = Object.getOwnPropertyDescriptor(
    Navigator.prototype,
    "language",
  )

  function stubLanguages(languages: readonly string[] | undefined) {
    Object.defineProperty(navigator, "languages", {
      configurable: true,
      get: () => languages,
    })
    Object.defineProperty(navigator, "language", {
      configurable: true,
      get: () => languages?.[0] ?? "en",
    })
  }

  beforeEach(() => {
    stubLanguages(["en-US", "en"])
  })

  afterEach(() => {
    if (originalLanguages) {
      Object.defineProperty(Navigator.prototype, "languages", originalLanguages)
    }
    if (originalLanguage) {
      Object.defineProperty(Navigator.prototype, "language", originalLanguage)
    }
  })

  it("flips isReady to true after the first effect-driven detection", async () => {
    const { result } = renderHook(() => useLocalePreference())
    // Hook seeds with isReady=false so the landing-page redirect
    // doesn't fire on the SSR pass (when the browser preference
    // isn't yet readable).
    await waitFor(() => expect(result.current.isReady).toBe(true))
    expect(result.current.locale).toBe("en")
  })

  it("resolves the locale from navigator.languages on the client", async () => {
    stubLanguages(["ga-IE", "en-IE"])
    const { result } = renderHook(() => useLocalePreference())
    await waitFor(() => expect(result.current.isReady).toBe(true))
    expect(result.current.locale).toBe("ga")
  })

  it("falls back to navigator.language when navigator.languages is empty", async () => {
    stubLanguages([])
    const { result } = renderHook(() => useLocalePreference())
    await waitFor(() => expect(result.current.isReady).toBe(true))
    // navigator.language stub returns "en" when languages array is empty.
    expect(result.current.locale).toBe("en")
  })

  it("re-detects when the browser fires a languagechange event", async () => {
    stubLanguages(["en"])
    const { result } = renderHook(() => useLocalePreference())
    await waitFor(() => expect(result.current.locale).toBe("en"))

    // Simulate the user changing the system language while the page
    // is open — the hook listens for `languagechange` to re-derive.
    stubLanguages(["ga-IE"])
    window.dispatchEvent(new Event("languagechange"))

    await waitFor(() => expect(result.current.locale).toBe("ga"))
  })
})
