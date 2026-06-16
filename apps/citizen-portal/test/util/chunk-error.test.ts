import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  isChunkLoadError,
  reloadOnceIfChunkLoadError,
} from "@/util/chunk-error"

describe("isChunkLoadError", () => {
  it("detects webpack's ChunkLoadError by name", () => {
    const err = new Error("Loading chunk 42 failed.")
    err.name = "ChunkLoadError"
    expect(isChunkLoadError(err)).toBe(true)
  })

  it("detects the classic webpack message for JS chunks", () => {
    expect(
      isChunkLoadError(new Error("Loading chunk 0-y71bmiuat1i failed.")),
    ).toBe(true)
  })

  it("detects the webpack message for CSS chunks", () => {
    expect(
      isChunkLoadError(
        new Error("Loading CSS chunk 0a1y2k5a97ahg failed."),
      ),
    ).toBe(true)
  })

  it("detects native dynamic-import failures (Chrome / Safari wording)", () => {
    expect(
      isChunkLoadError(
        new TypeError(
          "Failed to fetch dynamically imported module: https://example.test/_next/static/chunks/abc.js",
        ),
      ),
    ).toBe(true)
    expect(
      isChunkLoadError(
        new TypeError(
          "error loading dynamically imported module: foo.js",
        ),
      ),
    ).toBe(true)
  })

  it("returns false for unrelated errors", () => {
    expect(isChunkLoadError(new Error("Network request failed"))).toBe(false)
    expect(isChunkLoadError(new TypeError("Cannot read property 'x' of undefined"))).toBe(false)
  })

  it("tolerates non-Error inputs", () => {
    expect(isChunkLoadError(null)).toBe(false)
    expect(isChunkLoadError(undefined)).toBe(false)
    expect(isChunkLoadError("Loading chunk 1 failed")).toBe(false)
    expect(isChunkLoadError(42)).toBe(false)
    expect(isChunkLoadError({})).toBe(false)
    expect(isChunkLoadError({ name: "ChunkLoadError" })).toBe(true)
  })
})

describe("reloadOnceIfChunkLoadError", () => {
  const reloadSpy = vi.fn()
  const originalLocation = window.location

  beforeEach(() => {
    window.sessionStorage.clear()
    reloadSpy.mockClear()
    // jsdom's `Location.reload` is non-configurable, so we replace the whole
    // `window.location` object with a stub that records reload calls without
    // actually unloading the document.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    })
  })

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    })
    vi.restoreAllMocks()
  })

  it("triggers a reload once for a chunk-load error and returns true", () => {
    const err = new Error("Loading chunk 5 failed.")
    err.name = "ChunkLoadError"

    expect(reloadOnceIfChunkLoadError(err)).toBe(true)
    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it("does not reload a second time in the same tab", () => {
    const err = new Error("Loading chunk 5 failed.")
    err.name = "ChunkLoadError"

    expect(reloadOnceIfChunkLoadError(err)).toBe(true)
    expect(reloadOnceIfChunkLoadError(err)).toBe(false)
    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it("does not reload for errors that are not chunk-load failures", () => {
    expect(reloadOnceIfChunkLoadError(new Error("Boom"))).toBe(false)
    expect(reloadSpy).not.toHaveBeenCalled()
    expect(window.sessionStorage.length).toBe(0)
  })

  it("survives a sessionStorage that throws on setItem (Safari private mode)", () => {
    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("QuotaExceededError", "QuotaExceededError")
      })

    const err = new Error("Failed to fetch dynamically imported module: foo")

    expect(() => reloadOnceIfChunkLoadError(err)).not.toThrow()
    expect(reloadSpy).toHaveBeenCalledTimes(1)
    setItemSpy.mockRestore()
  })
})
