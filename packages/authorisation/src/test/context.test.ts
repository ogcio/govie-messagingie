import { describe, expect, it, vi } from "vitest"

vi.mock("@logto/next/server-actions", () => ({
  getLogtoContext: vi.fn(async () => ({
    isAuthenticated: true,
    claims: { sub: "user-1", organization_roles: ["org:Role"] },
  })),
}))

import type { IdTokenClaims, LogtoContext, LogtoNextConfig } from "@logto/next"
import { getLogtoContext } from "@logto/next/server-actions"
import {
  createGetLogtoContextOrRedirect,
  parseOrganizationRoles,
} from "../context"
import type { Logger } from "../types"

describe("context utils", () => {
  const mockLogger: Logger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  }

  const mockRedirectToLogin = vi.fn(() => {
    throw new Error("redirect")
  }) as unknown as (url?: string | null) => never

  it("returns context when authenticated", async () => {
    const getLogtoContextOrRedirect = createGetLogtoContextOrRedirect(
      mockRedirectToLogin,
      mockLogger,
    )
    const ctx = await getLogtoContextOrRedirect(
      {} as unknown as LogtoNextConfig,
    )
    expect(ctx.isAuthenticated).toBe(true)
  })

  it("parses organization roles and dedupes", () => {
    const roles = parseOrganizationRoles({
      organization_roles: ["a", "a", "b"],
    } as IdTokenClaims)
    expect(roles).toEqual(["a", "b"])
  })

  it("redirects when unauthenticated", async () => {
    vi.mocked(getLogtoContext).mockResolvedValueOnce({
      isAuthenticated: false,
      claims: undefined,
    } as unknown as LogtoContext)
    const getLogtoContextOrRedirect = createGetLogtoContextOrRedirect(
      mockRedirectToLogin,
      mockLogger,
    )
    await expect(
      getLogtoContextOrRedirect({} as unknown as LogtoNextConfig),
    ).rejects.toThrow()
  })
})
