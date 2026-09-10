import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { buildMemoryKVCache } from "./memory"

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("buildMemoryKVCache", () => {
  it("returns a stored value before expiry", async () => {
    const cache = buildMemoryKVCache()
    await cache.set("k", "v", 60)

    expect(await cache.get<string>("k")).toBe("v")
  })

  it("returns null for a missing key", async () => {
    const cache = buildMemoryKVCache()
    expect(await cache.get("missing")).toBeNull()
  })

  it("expires values after their TTL", async () => {
    const cache = buildMemoryKVCache()
    await cache.set("k", "v", 60)

    vi.advanceTimersByTime(61_000)

    expect(await cache.get("k")).toBeNull()
  })

  it("drops values that fail the validator", async () => {
    const cache = buildMemoryKVCache()
    await cache.set("k", "not-a-number", 60)

    const isNumber = (v: unknown): v is number => typeof v === "number"
    expect(await cache.get("k", isNumber)).toBeNull()
    // entry was evicted, not just filtered
    expect(await cache.get("k")).toBeNull()
  })

  it("returns values that pass the validator", async () => {
    const cache = buildMemoryKVCache()
    await cache.set("k", 42, 60)

    const isNumber = (v: unknown): v is number => typeof v === "number"
    expect(await cache.get("k", isNumber)).toBe(42)
  })

  it("destroy removes the key", async () => {
    const cache = buildMemoryKVCache()
    await cache.set("k", "v", 60)
    await cache.destroy("k")

    expect(await cache.get("k")).toBeNull()
  })
})
