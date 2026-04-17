import {
  ONBOARDING_PATH,
  ONBOARDING_SOURCE_PARAM,
  WRONG_LOGIN_METHOD_PATH,
  WRONG_LOGIN_RETURN_URL_PARAM,
} from "./constants"
import type { AppConfig } from "./types"

export type GetLoginUrlWithCustomPostLoginRedirect = (
  baseUrl: string,
  postLoginRedirect: string,
) => string

export const createBuildWrongLoginMethodRedirect = (
  config: AppConfig,
  _getLoginUrlWithCustomPostLoginRedirect: GetLoginUrlWithCustomPostLoginRedirect,
) => {
  return (currentPath?: string): string => {
    const currentUrl = currentPath
      ? new URL(currentPath, config.baseUrl)
      : config.baseUrl
    const redirectURL = new URL(WRONG_LOGIN_METHOD_PATH, config.profileUrl)
    redirectURL.searchParams.set(
      WRONG_LOGIN_RETURN_URL_PARAM,
      currentUrl.toString(),
    )
    return redirectURL.toString()
  }
}

export const createBuildOnboardingRedirectUrl = (
  config: AppConfig,
  getLoginUrlWithCustomPostLoginRedirect: GetLoginUrlWithCustomPostLoginRedirect,
) => {
  return (pathname: string): string => {
    const source = getLoginUrlWithCustomPostLoginRedirect(
      config.baseUrl,
      `${config.baseUrl}${pathname ?? ""}`,
    )
    const onboarding = new URL(ONBOARDING_PATH, config.profileUrl)
    onboarding.searchParams.set(ONBOARDING_SOURCE_PARAM, source)
    return onboarding.toString()
  }
}
