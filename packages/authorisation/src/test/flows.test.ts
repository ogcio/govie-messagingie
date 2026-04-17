import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => {
  const redirectMock = vi.fn(() => {
    throw new Error("redirect")
  })
  return {
    redirect: redirectMock as unknown as (...args: unknown[]) => never,
    RedirectType: { replace: "replace" },
  }
})

vi.mock("@logto/next/server-actions", () => ({
  signIn: vi.fn(async () => undefined),
  handleSignIn: vi.fn(async () => undefined),
}))

const cookieStore = new Map<
  string,
  { value: string; opts?: Record<string, unknown> }
>()
vi.mock("next/headers", () => ({
  cookies: () => ({
    set: (name: string, value: string, opts?: Record<string, unknown>) =>
      cookieStore.set(name, { value, opts }),
    get: (name: string) => cookieStore.get(name),
    delete: (nameOrObj: string | { name: string }) => {
      const key = typeof nameOrObj === "string" ? nameOrObj : nameOrObj.name
      cookieStore.delete(key)
    },
    getAll: () =>
      Array.from(cookieStore.keys()).map((k) => ({
        name: k,
        value: cookieStore.get(k)?.value,
      })),
  }),
}))

import type { LogtoNextConfig } from "@logto/next"
import { handleSignIn, signIn } from "@logto/next/server-actions"
import { CONNECTOR_ENTRAID, POST_LOGIN_SEARCH_PARAMS } from "../constants"
import {
  createApplicationLogout,
  createGetCitizenProfileOrRedirect,
  createLogin,
  createLoginCallback,
  createLogout,
  createPreLogin,
} from "../flows"
import type {
  AppConfig,
  AuthSessionContext,
  ConfigFactory,
  Logger,
  ProfileClient,
} from "../types"

const mockConfig: AppConfig = {
  messagingApiResource: "https://api.example.com/messaging",
  profileApiResource: "https://api.example.com/profile",
  uploadApiResource: "https://api.example.com/upload",
  baseUrl: "https://app.example.com",
  appId: "test-app-id",
  appSecret: "test-app-secret",
  logtoCookieSecret: "test-secret",
  logtoEndpoint: "https://logto.example.com",
  isProductionEnv: false,
  profileUrl: "https://profile.example.com",
  publicServantRedirectUrl: "https://admin.example.com",
  myGovIdEndSessionUrl: "https://idp.example.com/logout",
}

const mockLogger: Logger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}

const mockSetSocialConnectorCookie = vi.fn()
const mockSetPostLoginRedirectCookie = vi.fn()
const mockConsumePostLoginRedirectCookie = vi.fn<() => string | undefined>(
  () => undefined,
)
const mockDeleteAllCookies = vi.fn()
const mockDeleteLogtoCookies = vi.fn()
const mockRedirectToLogin = vi.fn(() => {
  throw new Error("redirect")
}) as unknown as (url?: string | null) => never

const mockGetLogtoContextOrRedirect = vi.fn(async () => ({
  isAuthenticated: true,
  claims: { sub: "u1", roles: ["citizen"] },
}))

const mockGetAuthSessionContext = vi.fn(async () => ({
  userId: "u1",
  isCitizen: true,
  isCitizenOnboarded: true,
  signinMethod: "social:mygovid",
}))

const mockGetCurrentPath = vi.fn(() => "/current")
const mockBuildWrongLoginMethodRedirect = vi.fn(() => "https://redirect.url")
const mockBuildOnboardingRedirectUrl = vi.fn(() => "https://onboarding.url")
const mockInvalidateCachedUserToken = vi.fn(async () => {})

const mockProfileClient: ProfileClient = {
  getProfile: vi.fn(async () => ({
    data: { id: "p1", email: "e" },
  })),
}

const mockConfigFactory: ConfigFactory = () => ({
  endpoint: "https://logto.example.com",
  appId: "test-app-id",
  appSecret: "test-app-secret",
  scopes: [],
  resources: [],
  cookieSecret: "test-secret",
  cookieSecure: false,
  baseUrl: "https://app.example.com",
})

describe("flows", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cookieStore.clear()
  })

  it("preLogin sets cookies and redirects", async () => {
    const preLogin = createPreLogin(
      mockConfig,
      mockSetSocialConnectorCookie,
      mockSetPostLoginRedirectCookie,
      mockRedirectToLogin,
    )
    const sp = new URLSearchParams({
      [POST_LOGIN_SEARCH_PARAMS.PostLoginRedirectPath]: "/home",
      [POST_LOGIN_SEARCH_PARAMS.LoginUrl]: "/api/after-login",
    })
    await expect(preLogin(sp)).rejects.toThrow()
    expect(mockSetSocialConnectorCookie).toHaveBeenCalled()
    expect(mockSetPostLoginRedirectCookie).toHaveBeenCalledWith("/home")
    // redirect is called but we can't easily test it due to hoisting
  })

  it("preLogin uses Entra ID connector when admin param is present", async () => {
    const preLogin = createPreLogin(
      mockConfig,
      mockSetSocialConnectorCookie,
      mockSetPostLoginRedirectCookie,
      mockRedirectToLogin,
    )
    const sp = new URLSearchParams({
      admin: "true",
    })
    await expect(preLogin(sp)).rejects.toThrow()
    expect(mockSetSocialConnectorCookie).toHaveBeenCalledWith(CONNECTOR_ENTRAID)
  })

  it("preLogin skips Entra ID connector locally when useGovIdOnly is true", async () => {
    const localConfig: AppConfig = {
      ...mockConfig,
      baseUrl: "http://localhost:3000",
      useGovIdOnly: true,
      isProductionEnv: false,
    }
    const preLogin = createPreLogin(
      localConfig,
      mockSetSocialConnectorCookie,
      mockSetPostLoginRedirectCookie,
      mockRedirectToLogin,
    )
    const sp = new URLSearchParams({
      admin: "true",
    })
    await expect(preLogin(sp)).rejects.toThrow()
    expect(mockSetSocialConnectorCookie).toHaveBeenCalledWith("mygovid")
  })

  it("login calls signIn", async () => {
    const login = createLogin(mockConfig, mockConfigFactory)
    await login()
    expect(signIn).toHaveBeenCalled()
  })

  it("loginCallback consumes cookie and redirects", async () => {
    vi.mocked(mockConsumePostLoginRedirectCookie).mockReturnValueOnce("/target")
    const loginCallback = createLoginCallback(
      mockConfig,
      mockConsumePostLoginRedirectCookie,
      mockRedirectToLogin,
      mockConfigFactory,
    )
    await expect(loginCallback(new URLSearchParams())).rejects.toThrow()
    expect(handleSignIn).toHaveBeenCalled()
    // redirect is called but we can't easily test it due to hoisting
  })

  it("logout deletes cookies and redirects", async () => {
    const mockGetAuthSessionUserId = vi.fn(async () => ({ userId: "u1" }))
    const logout = createLogout(
      mockConfig,
      mockDeleteAllCookies,
      mockInvalidateCachedUserToken,
      mockGetAuthSessionUserId,
      mockRedirectToLogin,
      mockConfigFactory,
      mockLogger,
    )
    await expect(logout()).rejects.toThrow()
    expect(mockDeleteAllCookies).toHaveBeenCalled()
    // redirect is called but we can't easily test it due to hoisting
  })

  it("logout does not warn when getAuthSessionUserId throws a NEXT_REDIRECT error", async () => {
    const redirectError = {
      digest: new String("NEXT_REDIRECT;replace;/api/pre-login;307;"),
    }
    const mockGetAuthSessionUserId = vi.fn(async () => {
      throw redirectError
    })

    const logout = createLogout(
      mockConfig,
      mockDeleteAllCookies,
      mockInvalidateCachedUserToken,
      mockGetAuthSessionUserId,
      mockRedirectToLogin,
      mockConfigFactory,
      mockLogger,
    )

    await expect(logout()).rejects.toThrow()
    expect(mockLogger.warn).not.toHaveBeenCalled()
    expect(mockDeleteAllCookies).toHaveBeenCalled()
  })

  it("applicationLogout sets expiry headers and deletes logto cookies", async () => {
    cookieStore.set("logto:session", { value: "s1" })
    cookieStore.set("logto:client", { value: "c1" })
    cookieStore.set("other-cookie", { value: "keep" })

    const applicationLogout = createApplicationLogout(mockDeleteLogtoCookies)
    const res = await applicationLogout()

    expect(mockDeleteLogtoCookies).toHaveBeenCalled()
    expect(res.status).toBe(200)

    const setCookieHeader = res.headers.get("set-cookie")
    expect(setCookieHeader).toBeTruthy()
    expect(setCookieHeader).toContain("logto:session")
    expect(setCookieHeader).toContain("logto:client")
    expect(setCookieHeader).not.toContain("other-cookie")
  })

  it("getCitizenProfileOrRedirect returns profile when citizen onboarded and allowed", async () => {
    const getCitizenProfileOrRedirect = createGetCitizenProfileOrRedirect(
      mockConfig,
      mockGetLogtoContextOrRedirect as unknown as (
        config: LogtoNextConfig,
      ) => Promise<{
        isAuthenticated: boolean
        claims: { sub: string; roles: string[] }
      }>,
      mockGetAuthSessionContext as unknown as (
        config: LogtoNextConfig,
      ) => Promise<AuthSessionContext>,
      mockGetCurrentPath,
      mockBuildWrongLoginMethodRedirect,
      mockBuildOnboardingRedirectUrl,
      mockInvalidateCachedUserToken,
      mockRedirectToLogin,
      () => mockProfileClient,
      "messaging",
      mockConfigFactory,
      mockLogger,
    )
    const res = await getCitizenProfileOrRedirect()
    expect((res as { profile: { id: string } }).profile?.id).toBe("p1")
  })
})
