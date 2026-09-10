import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("suppressAuthRedirectNoise", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetModules()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("does nothing without a browser window", async () => {
    vi.stubGlobal("window", undefined)
    const { suppressAuthRedirectNoise } = await import(
      "./suppress-auth-redirect-noise"
    )

    expect(suppressAuthRedirectNoise()).toBeUndefined()
  })

  it("suppresses only benign auth errors during redirect", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const { suppressAuthRedirectNoise } = await import(
      "./suppress-auth-redirect-noise"
    )

    console.error("Error checking auth", new Error("Load failed"))
    expect(error).toHaveBeenCalledTimes(1)

    suppressAuthRedirectNoise()
    console.error("Error checking auth", new Error("Failed to fetch"))
    expect(error).toHaveBeenCalledTimes(1)

    console.error("Error checking auth", new Error("Gateway unavailable"))
    console.error("Other error", new Error("Load failed"))
    expect(error).toHaveBeenCalledTimes(3)

    vi.advanceTimersByTime(10_000)
    console.error("Error checking auth", new Error("Network error"))
    expect(error).toHaveBeenCalledTimes(4)
  })

  it("handles non-Error details and patches the console once", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const { suppressAuthRedirectNoise } = await import(
      "./suppress-auth-redirect-noise"
    )

    suppressAuthRedirectNoise()
    suppressAuthRedirectNoise()
    console.error("Error checking auth", "request aborted")
    console.error("Error checking auth", null)

    expect(error).toHaveBeenCalledOnce()
    expect(error).toHaveBeenCalledWith("Error checking auth", null)
  })
})
