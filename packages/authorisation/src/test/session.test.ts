import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}))

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: () => undefined,
    set: vi.fn(),
    delete: vi.fn(),
    getAll: () => [],
  }),
}))

vi.mock("@logto/next/server-actions", () => ({
  getLogtoContext: vi.fn(),
  getAccessToken: vi.fn(),
}))

vi.mock("../selected-organization-handler", () => ({
  SelectedOrganizationHandler: {
    get: vi.fn(() => undefined),
    set: vi.fn(),
    delete: vi.fn(),
    isSet: vi.fn(() => false),
  },
}))

import type { LogtoContext, LogtoNextConfig } from "@logto/next"
import { ALLOWED_SIGNIN_METHODS } from "../constants"
import {
  createGetAuthSessionContext,
  createGetAuthSessionOrganizations,
  createGetAuthSessionUserId,
} from "../session"

const mockGetLogtoContextOrRedirect = vi.fn(async () => ({
  isAuthenticated: true,
  claims: {
    sub: "user-1",
    roles: ["Onboarded citizen"],
    organization_roles: [],
  },
  userInfo: { email: "e" },
}))

const mockGetTokenOrRedirect = vi.fn(async () => "mocked-token")

vi.mock("../token", () => ({
  getUserSignInMethod: vi.fn(() => ALLOWED_SIGNIN_METHODS[0]),
}))

describe("session utils", () => {
  it("builds session context", async () => {
    const getAuthSessionContext = createGetAuthSessionContext(
      mockGetLogtoContextOrRedirect as unknown as (
        config: LogtoNextConfig,
      ) => Promise<LogtoContext>,
      mockGetTokenOrRedirect,
      ["Public Servant"],
      false,
    )
    const ctx = await getAuthSessionContext({} as unknown as LogtoNextConfig)
    expect(ctx.userId).toBe("user-1")
    expect(ctx.isCitizen).toBe(true)
    expect(ctx.isCitizenOnboarded).toBe(true)
    expect(ctx.signinMethod).toBe(ALLOWED_SIGNIN_METHODS[0])
  })

  it("returns user id only", async () => {
    const getAuthSessionUserId = createGetAuthSessionUserId(
      mockGetLogtoContextOrRedirect as unknown as (
        config: LogtoNextConfig,
      ) => Promise<LogtoContext>,
    )
    const out = await getAuthSessionUserId({} as unknown as LogtoNextConfig)
    expect(out.userId).toBe("user-1")
  })

  it("returns organizations and picks default when cookie missing", async () => {
    const mockOrgContext = vi.fn(async () => ({
      isAuthenticated: true,
      claims: {
        sub: "user-2",
        organization_roles: ["org-1:RoleA", "org-2:RoleB"],
      },
      userInfo: {
        organization_data: [
          { id: "org-1", name: "Org One", description: "" },
          { id: "org-2", name: "Org Two", description: "" },
        ],
      },
    }))

    const getAuthSessionOrganizations = createGetAuthSessionOrganizations(
      mockOrgContext as unknown as (
        config: LogtoNextConfig,
      ) => Promise<LogtoContext>,
    )

    const result = await getAuthSessionOrganizations(
      {} as unknown as LogtoNextConfig,
    )

    expect(result.userId).toBe("user-2")
    expect(result.currentOrganization?.id).toBe("org-1")
    expect(result.organizations).toHaveLength(2)
  })

  it("throws when no organizations are available", async () => {
    const mockOrgContextNoOrgs = vi.fn(async () => ({
      isAuthenticated: true,
      claims: {
        sub: "user-3",
        organization_roles: [],
      },
      userInfo: { organization_data: [] },
    }))

    const getAuthSessionOrganizations = createGetAuthSessionOrganizations(
      mockOrgContextNoOrgs as unknown as (
        config: LogtoNextConfig,
      ) => Promise<LogtoContext>,
    )

    await expect(
      getAuthSessionOrganizations({} as unknown as LogtoNextConfig),
    ).rejects.toThrowError("No organizations found for the current user")
  })
})
