import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  FLAGS_READY_TIMEOUT_MS,
  useFlagsReadyWithFallback,
} from "@/hooks/use-flags-ready-with-fallback"

const useFlagsStatus = vi.fn()

vi.mock("@unleash/proxy-client-react", () => ({
  useFlagsStatus: () => useFlagsStatus(),
}))

describe("useFlagsReadyWithFallback", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useFlagsStatus.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("waits while Unleash is still connecting", () => {
    useFlagsStatus.mockReturnValue({ flagsReady: false, flagsError: null })

    const { result } = renderHook(() => useFlagsReadyWithFallback())

    expect(result.current).toEqual({
      isFlagsReady: false,
      useFallbackValues: false,
    })
  })

  it("uses live flag values once Unleash connects", () => {
    useFlagsStatus.mockReturnValue({ flagsReady: true, flagsError: null })

    const { result } = renderHook(() => useFlagsReadyWithFallback())

    expect(result.current).toEqual({
      isFlagsReady: true,
      useFallbackValues: false,
    })
  })

  it("falls back to false flags when Unleash reports an error", () => {
    useFlagsStatus.mockReturnValue({
      flagsReady: false,
      flagsError: new Error("network"),
    })

    const { result } = renderHook(() => useFlagsReadyWithFallback())

    expect(result.current).toEqual({
      isFlagsReady: true,
      useFallbackValues: true,
    })
  })

  it("falls back to false flags after the readiness timeout", () => {
    useFlagsStatus.mockReturnValue({ flagsReady: false, flagsError: null })

    const { result } = renderHook(() => useFlagsReadyWithFallback())

    act(() => {
      vi.advanceTimersByTime(FLAGS_READY_TIMEOUT_MS)
    })

    expect(result.current).toEqual({
      isFlagsReady: true,
      useFallbackValues: true,
    })
  })
})
