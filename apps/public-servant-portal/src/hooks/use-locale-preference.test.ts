import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { matchLocale, useLocalePreference } from "./use-locale-preference"

const { readLocaleCookie } = vi.hoisted(() => ({
  readLocaleCookie: vi.fn(),
}))

vi.mock("@/util/locale-cookie", () => ({ readLocaleCookie }))

describe(matchLocale.name, () => {
  it("matches supported browser locales and falls back to English", () => {
    expect(matchLocale(["ga-IE", "en"])).toBe("ga")
    expect(matchLocale(["fr-FR"])).toBe("en")
  })
})

describe(useLocalePreference.name, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readLocaleCookie.mockReturnValue(null)
    Object.defineProperty(navigator, "languages", {
      configurable: true,
      value: ["ga-IE", "en"],
    })
  })

  it("prefers the persisted locale", async () => {
    readLocaleCookie.mockReturnValue("ga")
    const { result } = renderHook(() => useLocalePreference())

    await waitFor(() => expect(result.current.isReady).toBe(true))
    expect(result.current.locale).toBe("ga")
  })

  it("uses browser preferences and reacts to language changes", async () => {
    const { result } = renderHook(() => useLocalePreference())
    await waitFor(() => expect(result.current.locale).toBe("ga"))

    Object.defineProperty(navigator, "languages", {
      configurable: true,
      value: [],
    })
    Object.defineProperty(navigator, "language", {
      configurable: true,
      value: "en-IE",
    })
    act(() => window.dispatchEvent(new Event("languagechange")))

    await waitFor(() => expect(result.current.locale).toBe("en"))
  })
})
