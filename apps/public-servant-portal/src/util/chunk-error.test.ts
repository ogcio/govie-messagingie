import { beforeEach, describe, expect, it, vi } from "vitest"
import { isChunkLoadError, reloadOnceIfChunkLoadError } from "./chunk-error"

beforeEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
})

describe(isChunkLoadError.name, () => {
  it.each([
    { name: "ChunkLoadError" },
    { message: "Loading chunk 123 failed" },
    { message: "Loading CSS chunk abc-def failed" },
    { message: "Failed to fetch dynamically imported module" },
    { message: "error loading dynamically imported module" },
  ])("recognizes chunk load failures", (error) => {
    expect(isChunkLoadError(error)).toBe(true)
  })

  it.each([null, "error", {}, { message: 42 }, { message: "Network error" }])(
    "rejects unrelated values",
    (error) => {
      expect(isChunkLoadError(error)).toBe(false)
    },
  )
})

describe(reloadOnceIfChunkLoadError.name, () => {
  it("does not reload for an unrelated error", () => {
    expect(reloadOnceIfChunkLoadError(new Error("Network error"))).toBe(false)
  })

  it("does not reload more than once per tab", () => {
    sessionStorage.setItem("messaging-next:chunk-reload-attempted", "1")

    expect(reloadOnceIfChunkLoadError({ name: "ChunkLoadError" })).toBe(false)
  })

  it("survives inaccessible session storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    vi.spyOn(console, "error").mockImplementation(() => {})

    expect(reloadOnceIfChunkLoadError({ name: "ChunkLoadError" })).toBe(true)
  })
})
