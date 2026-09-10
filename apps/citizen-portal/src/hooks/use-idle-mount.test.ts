import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useIdleMount } from "./use-idle-mount"

describe("useIdleMount", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it("uses requestIdleCallback after the first paint", () => {
    let afterPaint: (() => void) | undefined
    let markReady: (() => void) | undefined
    const cancelIdleCallback = vi.fn()
    const cancelAnimationFrame = vi.fn()
    vi.stubGlobal("requestAnimationFrame", (callback: () => void) => {
      afterPaint = callback
      return 1
    })
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame)
    vi.stubGlobal(
      "requestIdleCallback",
      (callback: () => void, options: { timeout: number }) => {
        markReady = callback
        expect(options).toEqual({ timeout: 123 })
        return 2
      },
    )
    vi.stubGlobal("cancelIdleCallback", cancelIdleCallback)

    const { result, unmount } = renderHook(() => useIdleMount(123))
    act(() => afterPaint?.())
    act(() => markReady?.())
    expect(result.current).toBe(true)

    unmount()
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1)
    expect(cancelIdleCallback).toHaveBeenCalledWith(2)
  })

  it("falls back to a timeout and ignores callbacks after unmount", () => {
    vi.useFakeTimers()
    let afterPaint: (() => void) | undefined
    vi.stubGlobal("requestAnimationFrame", (callback: () => void) => {
      afterPaint = callback
      return 1
    })
    vi.stubGlobal("cancelAnimationFrame", vi.fn())
    vi.stubGlobal("requestIdleCallback", undefined)

    const { unmount } = renderHook(useIdleMount)
    act(() => afterPaint?.())
    unmount()
    act(() => vi.runAllTimers())
  })
})
