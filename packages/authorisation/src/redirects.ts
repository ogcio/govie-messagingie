import { headers } from "next/headers"
import { redirect } from "next/navigation"
import {
  DEFAULT_POST_LOGIN_REDIRECT_URL,
  END_SESSION_POST_LOGOUT_REDIRECT_PARAM,
  POST_LOGIN_SEARCH_PARAMS,
  SIGNOUT_PATH,
} from "./constants"
import type { AppConfig, CustomHeaders, Routes } from "./types"

export const createRedirectToLogin = (
  config: AppConfig,
  customHeaders: CustomHeaders,
  routes: Routes,
) => {
  return (url?: string | null): never => {
    return redirect(
      url ??
        createBuildLoginUrlWithPostLoginRedirect(
          config,
          customHeaders,
          routes,
        )() ??
        DEFAULT_POST_LOGIN_REDIRECT_URL,
    )
  }
}

export const createBuildLoginUrlWithPostLoginRedirect = (
  config: AppConfig,
  customHeaders: CustomHeaders,
  routes: Routes,
) => {
  return () => {
    const currentPath = headers().get(customHeaders.Pathname) ?? ""
    const currentSearch = headers().get(customHeaders.Search) ?? ""
    let redirectPath = currentPath
    if (currentSearch.trim().length > 0) {
      redirectPath = `${redirectPath}${encodeURI(currentSearch.trim())}`
    }
    const qp = new URLSearchParams({
      [POST_LOGIN_SEARCH_PARAMS.LoginUrl]: routes.logtoLogin.url,
      [POST_LOGIN_SEARCH_PARAMS.PostLoginRedirectPath]: redirectPath,
    })

    if (config.isPublicServant) {
      qp.set("admin", "true")
    }

    return `${routes.preLogin.url}?${qp.toString()}`
  }
}

export const createGetLoginUrlWithCustomPostLoginRedirect = (
  _config: AppConfig,
  routes: Routes,
) => {
  return (baseUrl: string, postLoginRedirect: string) => {
    const qp = new URLSearchParams({
      [POST_LOGIN_SEARCH_PARAMS.LoginUrl]: routes.logtoLogin.url,
      [POST_LOGIN_SEARCH_PARAMS.PostLoginRedirectPath]: postLoginRedirect,
    })
    return `${baseUrl}${routes.preLogin.url}?${qp.toString()}`
  }
}

export const createPreLogoutRedirect = (config: AppConfig) => {
  return (): never => {
    const signoutUrl = new URL(SIGNOUT_PATH, config.baseUrl).toString()
    const endSessionUrl = new URL(config.myGovIdEndSessionUrl)
    endSessionUrl.searchParams.set(
      END_SESSION_POST_LOGOUT_REDIRECT_PARAM,
      signoutUrl,
    )
    return redirect(endSessionUrl.toString())
  }
}
