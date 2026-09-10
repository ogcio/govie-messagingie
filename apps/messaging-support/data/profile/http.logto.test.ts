import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  fetchLogtoUserRole,
  fetchLogtoUsers,
  fetchM2MmanagementAccessToken,
  fetchPatchLinkedAccount,
} from "./http"

vi.mock("@/utils/env", () => ({
  getEnvConfig: () => ({
    PROFILE_API_RESOURCE_URL: "https://profile.test/",
    LOGTO_URL: "https://logto.test",
    M2M_MANAGEMENT_ID: "m2m-id",
    M2M_MANAGEMENT_SECRET: "m2m-secret",
    MANAGEMENT_API: "https://mgmt.test",
  }),
}))

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("fetchPatchLinkedAccount", () => {
  it("PATCHes the profile with the primary user id", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })

    const result = await fetchPatchLinkedAccount({
      bearerToken: "token-1",
      profileId: "p-1",
      primaryUserId: "u-1",
    })

    expect(result.success).toBe(true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url.toString()).toBe(
      "https://profile.test/api/v1/organisations/profiles/p-1",
    )
    expect(init.method).toBe("PATCH")
    expect(JSON.parse(init.body)).toEqual({ primaryUserId: "u-1" })
    expect(init.headers.Authorization).toBe("Bearer token-1")
  })

  it("fails on a non-ok response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ message: "nope" }),
    })

    const result = await fetchPatchLinkedAccount({
      bearerToken: "token-1",
      profileId: "p-1",
      primaryUserId: null,
    })

    expect(result.success).toBe(false)
  })
})

describe("fetchM2MmanagementAccessToken", () => {
  it("posts client credentials and returns the access token", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "mgmt-token" }),
    })

    const result = await fetchM2MmanagementAccessToken()

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value).toBe("mgmt-token")

    const [url, init] = fetchMock.mock.calls[0]
    expect(url.toString()).toBe("https://logto.test/oidc/token")
    const body = init.body as URLSearchParams
    expect(body.get("grant_type")).toBe("client_credentials")
    expect(body.get("client_id")).toBe("m2m-id")
    expect(body.get("resource")).toBe("https://mgmt.test")
  })

  it("fails on a non-ok response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "unauthorized",
    })

    const result = await fetchM2MmanagementAccessToken()

    expect(result.success).toBe(false)
  })

  it("fails when fetch throws", async () => {
    fetchMock.mockRejectedValue(new Error("network down"))

    const result = await fetchM2MmanagementAccessToken()

    expect(result.success).toBe(false)
  })
})

describe("fetchLogtoUsers", () => {
  it("queries users by id with exact matching", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ id: "u-1" }],
    })

    const result = await fetchLogtoUsers(["u-1", "u-2"], "mgmt-token")

    expect(result.success).toBe(true)
    const [url] = fetchMock.mock.calls[0]
    expect(url).toContain("https://logto.test/api/users?")
    expect(url).toContain("search.id=u-1")
    expect(url).toContain("search.id=u-2")
    expect(url).toContain("mode.id=exact")
  })

  it("fails on a non-ok response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "boom",
    })

    const result = await fetchLogtoUsers(["u-1"], "mgmt-token")

    expect(result.success).toBe(false)
  })
})

describe("fetchLogtoUserRole", () => {
  it("fetches roles per profile id", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ name: "admin" }],
    })

    const result = await fetchLogtoUserRole(["u-1", "u-2"], "mgmt-token")

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value).toEqual([[{ name: "admin" }], [{ name: "admin" }]])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("returns an empty role list for a non-ok response", async () => {
    fetchMock.mockResolvedValue({ ok: false })

    const result = await fetchLogtoUserRole(["u-1"], "mgmt-token")

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value).toEqual([[]])
  })
})
