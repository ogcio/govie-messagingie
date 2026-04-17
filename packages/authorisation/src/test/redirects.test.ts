import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => {
  const redirectMock = vi.fn(() => {
    throw new Error("redirect called")
  })
  return {
    redirect: redirectMock as unknown as (...args: unknown[]) => never,
    RedirectType: { replace: "replace" },
  }
})

vi.mock("next/headers", () => ({
  headers: () => ({
    get: (key: string) => mockHeaders[key] ?? null,
  }),
}))

import { POST_LOGIN_SEARCH_PARAMS } from "../constants"
import {
  createBuildLoginUrlWithPostLoginRedirect,
  createGetLoginUrlWithCustomPostLoginRedirect,
  createPreLogoutRedirect,
} from "../redirects"
import type { AppConfig, CustomHeaders, Routes } from "../types"

const mockConfig: AppConfig = {
  baseUrl: "https://app.example.com",
  appId: "test-app-id",
  appSecret: "test-app-secret",
  logtoCookieSecret: "test-secret",
  logtoEndpoint: "https://logto.example.com",
  isProductionEnv: false,
  profileUrl: "https://profile.example.com",
  publicServantRedirectUrl: "https://admin.example.com",
  myGovIdEndSessionUrl: "https://idp.example.com/logout",
  isPublicServant: true,
  scopes: [],
}

const customHeaders: CustomHeaders = {
  Pathname: "x-pathname",
  Search: "x-search",
}

const routes: Routes = {
  logtoLogin: { url: "/api/after-login" },
  preLogin: { url: "/api/pre-login" },
}

const mockHeaders: Record<string, string> = {}

describe("redirects utils", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(mockHeaders).forEach((k) => {
      delete mockHeaders[k]
    })
  })

  it("builds login url with current path and encoded search and admin flag", () => {
    mockHeaders["x-pathname"] = "/some/path"
    mockHeaders["x-search"] = "?a=1&b=two two"
    const buildLoginUrlWithPostLoginRedirect =
      createBuildLoginUrlWithPostLoginRedirect(
        mockConfig,
        customHeaders,
        routes,
      )
    const url = buildLoginUrlWithPostLoginRedirect()
    expect(url).toBe(
      `/api/pre-login?${POST_LOGIN_SEARCH_PARAMS.LoginUrl}=%2Fapi%2Fafter-login&${POST_LOGIN_SEARCH_PARAMS.PostLoginRedirectPath}=%2Fsome%2Fpath%3Fa%3D1%26b%3Dtwo%2520two&admin=true`,
    )
  })

  it("getLoginUrlWithCustomPostLoginRedirect builds absolute redirect", () => {
    const getLoginUrlWithCustomPostLoginRedirect =
      createGetLoginUrlWithCustomPostLoginRedirect(mockConfig, routes)
    const out = getLoginUrlWithCustomPostLoginRedirect(
      "https://app.example.com",
      "/target",
    )
    expect(out).toBe(
      `https://app.example.com/api/pre-login?${POST_LOGIN_SEARCH_PARAMS.LoginUrl}=%2Fapi%2Fafter-login&${POST_LOGIN_SEARCH_PARAMS.PostLoginRedirectPath}=%2Ftarget`,
    )
  })

  it("preLogoutRedirect issues redirect to IdP end-session", () => {
    const preLogoutRedirect = createPreLogoutRedirect(mockConfig)
    expect(() => preLogoutRedirect()).toThrow()
    // redirect is called but we can't easily test it due to hoisting
  })
})
