import { describe, expect, it, vi } from "vitest"
import { coalesce, coalesceAuthChecks } from "../src/auth-check-coalesce"

describe("coalesce", () => {
  it("shares a single in-flight promise for concurrent calls", async () => {
    let resolve!: (value: string) => void
    const fn = vi.fn(
      () =>
        new Promise<string>((r) => {
          resolve = r
        }),
    )
    const coalesced = coalesce(fn, 1_000)

    const a = coalesced()
    const b = coalesced()

    expect(fn).toHaveBeenCalledTimes(1)

    resolve("ok")
    await expect(a).resolves.toBe("ok")
    await expect(b).resolves.toBe("ok")
  })

  it("reuses the resolved value within the TTL, even for sequential calls", async () => {
    let time = 0
    const fn = vi.fn(async () => "value")
    const coalesced = coalesce(fn, 1_000, () => time)

    await expect(coalesced()).resolves.toBe("value")
    time = 500
    await expect(coalesced()).resolves.toBe("value")

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("refetches once the TTL has elapsed", async () => {
    let time = 0
    const fn = vi.fn(async () => "value")
    const coalesced = coalesce(fn, 1_000, () => time)

    await coalesced()
    time = 1_001
    await coalesced()

    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("does not cache rejections", async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("recovered")
    const coalesced = coalesce(fn, 1_000)

    await expect(coalesced()).rejects.toThrow("boom")
    await expect(coalesced()).resolves.toBe("recovered")
    expect(fn).toHaveBeenCalledTimes(2)
  })
})

describe("coalesceAuthChecks", () => {
  it("collapses duplicate auth/health checks to one gateway call each", async () => {
    const checkAuth = vi.fn(async () => ({ isAuthenticated: true }))
    const checkHealth = vi.fn(async () => ({ available: true }))
    // Minimal stand-in for the SagClient surface we patch.
    const client = { checkAuth, checkHealth } as unknown as Parameters<
      typeof coalesceAuthChecks
    >[0]

    coalesceAuthChecks(client)

    await Promise.all([client.checkAuth(), client.checkAuth()])
    await Promise.all([client.checkHealth(), client.checkHealth()])

    expect(checkAuth).toHaveBeenCalledTimes(1)
    expect(checkHealth).toHaveBeenCalledTimes(1)
  })

  it("is idempotent — patching twice does not double-wrap", () => {
    const checkAuth = vi.fn(async () => ({ isAuthenticated: true }))
    const checkHealth = vi.fn(async () => ({ available: true }))
    const client = { checkAuth, checkHealth } as unknown as Parameters<
      typeof coalesceAuthChecks
    >[0]

    coalesceAuthChecks(client)
    const patchedAuth = client.checkAuth
    coalesceAuthChecks(client)

    expect(client.checkAuth).toBe(patchedAuth)
  })
})
