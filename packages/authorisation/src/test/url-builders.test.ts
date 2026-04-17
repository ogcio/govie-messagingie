import { describe, expect, it } from "vitest"
import {
  ONBOARDING_PATH,
  WRONG_LOGIN_METHOD_PATH,
  WRONG_LOGIN_RETURN_URL_PARAM,
} from "../constants"
import type { AppConfig } from "../types"
import {
  createBuildOnboardingRedirectUrl,
  createBuildWrongLoginMethodRedirect,
} from "../url-builders"

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

const mockGetLoginUrlWithCustomPostLoginRedirect = (
  baseUrl: string,
  postLoginRedirect: string,
) => {
  return `${baseUrl}/api/pre-login?postLoginRedirectPath=${encodeURIComponent(postLoginRedirect)}`
}

describe("url-builders", () => {
  it("builds wrong login method redirect with returnUrl", () => {
    const buildWrongLoginMethodRedirect = createBuildWrongLoginMethodRedirect(
      mockConfig,
      mockGetLoginUrlWithCustomPostLoginRedirect,
    )
    const url = buildWrongLoginMethodRedirect("/some/path")
    expect(url).toContain(
      `https://profile.example.com${WRONG_LOGIN_METHOD_PATH}`,
    )
    expect(url).toContain(`${WRONG_LOGIN_RETURN_URL_PARAM}=`)
    expect(decodeURIComponent(url)).toContain(
      "https://app.example.com/some/path",
    )
  })

  it("builds onboarding redirect with encoded source", () => {
    const buildOnboardingRedirectUrl = createBuildOnboardingRedirectUrl(
      mockConfig,
      mockGetLoginUrlWithCustomPostLoginRedirect,
    )
    const url = buildOnboardingRedirectUrl("/current")
    expect(url).toContain(
      `https://profile.example.com${ONBOARDING_PATH}?source=`,
    )
    const source = url.split("source=")[1]
    expect(decodeURIComponent(source)).toContain("/pre-login?")
  })
})
