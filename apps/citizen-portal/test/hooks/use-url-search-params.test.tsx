import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

let currentSearchParams = new URLSearchParams()

vi.mock("next/navigation", () => ({
  useSearchParams: () => currentSearchParams,
}))

describe("useUrlSearchParams", () => {
  beforeEach(() => {
    currentSearchParams = new URLSearchParams("search=payslip")
    window.history.replaceState({}, "", "/en/messages?search=payslip")
    vi.resetModules()
  })

  it("stays in sync with history.replaceState after a clear (AB#40679)", async () => {
    // Force the production path so we exercise the history-backed store
    // instead of the NODE_ENV=test shortcut that returns Next's params.
    vi.stubEnv("NODE_ENV", "production")
    const { useUrlSearchParams } = await import(
      "@/hooks/use-url-search-params"
    )

    const { result } = renderHook(() => useUrlSearchParams())
    expect(result.current.get("search")).toBe("payslip")

    act(() => {
      window.history.replaceState({}, "", "/en/messages")
    })

    expect(result.current.get("search")).toBeNull()
    expect(window.location.pathname + window.location.search).toBe(
      "/en/messages",
    )

    vi.unstubAllEnvs()
  })

  it("does not follow a stale Next useSearchParams value after replaceState", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const { useUrlSearchParams } = await import(
      "@/hooks/use-url-search-params"
    )

    const { result } = renderHook(() => useUrlSearchParams())

    act(() => {
      // Simulate the AB#40679 clear: address bar is cleaned while Next's
      // useSearchParams() still reports the pre-reload search term.
      window.history.replaceState({}, "", "/en/messages")
      currentSearchParams = new URLSearchParams("search=payslip")
    })

    expect(result.current.get("search")).toBeNull()

    vi.unstubAllEnvs()
  })
})
