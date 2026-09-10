import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/utils/env", () => ({
  getEnvConfig: () => ({
    LOGTO_URL: "https://logto.test",
    LOGTO_M2M_CLIENT_ID: "client-id",
    LOGTO_M2M_CLIENT_SECRET: "client-secret",
    LOGTO_PLATFORM_ADMIN_RESOURCE: "internal://platform-admin",
  }),
}))

const fetchMock = vi.fn()

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// The module caches tokens in a module-level KV cache, so each test imports a
// fresh copy via resetModules.
async function freshAppHttp() {
  const { AppHttp } = await import("./http")
  return AppHttp
}

describe("AppHttp.fetchAppM2MToken", () => {
  it("posts client credentials to the logto token endpoint", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "t-1", expires_in: 3600 }),
    })
    const AppHttp = await freshAppHttp()

    const result = await AppHttp.fetchAppM2MToken()

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value).toBe("t-1")

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://logto.test/oidc/token")
    const body = init.body as URLSearchParams
    expect(body.get("grant_type")).toBe("client_credentials")
    expect(body.get("client_id")).toBe("client-id")
    expect(body.get("resource")).toBe("internal://platform-admin")
  })

  it("returns the cached token on subsequent calls", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "t-1", expires_in: 3600 }),
    })
    const AppHttp = await freshAppHttp()

    await AppHttp.fetchAppM2MToken()
    const second = await AppHttp.fetchAppM2MToken()

    expect(second.success).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("fails on a non-ok response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ message: "denied" }),
    })
    const AppHttp = await freshAppHttp()

    const result = await AppHttp.fetchAppM2MToken()

    expect(result.success).toBe(false)
  })

  it("fails when the token payload is malformed", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ nope: true }),
    })
    const AppHttp = await freshAppHttp()

    const result = await AppHttp.fetchAppM2MToken()

    expect(result.success).toBe(false)
  })

  it("fails when fetch throws", async () => {
    fetchMock.mockRejectedValue(new Error("network down"))
    const AppHttp = await freshAppHttp()

    const result = await AppHttp.fetchAppM2MToken()

    expect(result.success).toBe(false)
  })
})
