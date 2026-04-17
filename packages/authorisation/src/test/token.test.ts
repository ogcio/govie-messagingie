import { describe, expect, it, vi } from "vitest"

vi.mock("jose", async () => {
  return {
    createRemoteJWKSet: vi.fn(() => ({})),
    jwtVerify: vi.fn(async (_t, _jwks, _opts) => ({
      payload: { sub: "u", signInMethod: "social:mygovid" },
    })),
  }
})

import type { LogtoNextConfig } from "@logto/next"
import { createGetCachedOrganizationToken, getUserAccessToken } from "../token"
import type { RedisConnection } from "../types"

vi.mock("@logto/next/server-actions", () => ({
  getAccessTokenRSC: vi.fn(async () => "fake-token"),
  getAccessToken: vi.fn(async () => "fake-token"),
  getOrganizationToken: vi.fn(async (_cfg, orgId?: string) =>
    orgId ? `org-token-${orgId}` : "org-token",
  ),
}))

describe("token utils", () => {
  it("getUserAccessToken returns token", async () => {
    const cfg = {
      endpoint: "https://idp",
      resources: ["res"],
    } as unknown as LogtoNextConfig
    const token = await getUserAccessToken(cfg, "resource")
    expect(token).toBe("fake-token")
  })

  describe("createGetCachedOrganizationToken", () => {
    const redisConnection: RedisConnection = {
      getToken: vi.fn(),
      deleteToken: vi.fn(),
    }

    const logger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    }

    const configFactory = vi.fn(
      () => ({ endpoint: "http://example", resources: [] }) as LogtoNextConfig,
    )

    const tokenServiceName = "svc"

    it("fetches and caches org token with user and organization ids", async () => {
      ;(redisConnection.getToken as unknown as vi.Mock).mockImplementation(
        async ({ getTokenFn }) => {
          return await getTokenFn(tokenServiceName)
        },
      )

      const getCachedOrgToken = createGetCachedOrganizationToken(
        redisConnection,
        logger,
        configFactory,
        tokenServiceName,
      )

      const token = await getCachedOrgToken("user-1", "org-1")

      expect(token).toBe("org-token-org-1")
      expect(redisConnection.getToken).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          organizationId: "org-1",
          serviceName: tokenServiceName,
        }),
      )
    })

    it("throws if userId is missing", async () => {
      const getCachedOrgToken = createGetCachedOrganizationToken(
        redisConnection,
        logger,
        configFactory,
        tokenServiceName,
      )

      await expect(getCachedOrgToken(undefined, "org-1")).rejects.toThrowError(
        "Missing user id claims",
      )
    })

    it("throws if organizationId is missing", async () => {
      const getCachedOrgToken = createGetCachedOrganizationToken(
        redisConnection,
        logger,
        configFactory,
        tokenServiceName,
      )

      await expect(getCachedOrgToken("user-1", undefined)).rejects.toThrowError(
        "Missing organization id",
      )
    })
  })
})
