import { cookies } from "next/headers"
import {
  CONNECTOR_MYGOVID,
  LOGTO_POST_LOGIN_REDIRECT_URL_COOKIE_NAME,
  LOGTO_SOCIAL_CONNECTOR_ID_COOKIE_NAME,
  POST_GLOBAL_SIGNOUT_COOKIE_NAME,
  PRE_LOGIN_COOKIE_EXPIRATION_TIME_MS,
  SOCIAL_CONNECTOR_COOKIE_EXPIRATION_TIME_MS,
} from "./constants"
import type { AppConfig } from "./types"

const expireCookie = (name: string, config: AppConfig, domain?: string) => {
  const cookieStore = cookies()
  const isLocal = Boolean(config.baseUrl.includes("localhost"))
  cookieStore.set(name, "", {
    maxAge: 0,
    expires: new Date(0),
    path: "/",
    domain,
    secure: config.isProductionEnv || !isLocal,
    sameSite: isLocal && !config.isProductionEnv ? "lax" : "none",
  })

  if (domain) {
    cookieStore.delete({ name, domain, path: "/" })
  } else {
    cookieStore.delete(name)
  }
}

export const createSetSocialConnectorCookie = (config: AppConfig) => {
  // Messaging-specific: accepts an optional connectorId (defaults to MyGovID)
  // so that the admin connector (Entra ID) can also be selected via createPreLogin.
  return (connectorId: string = CONNECTOR_MYGOVID) => {
    const isLocal = Boolean(config.baseUrl.includes("localhost"))
    cookies().set(LOGTO_SOCIAL_CONNECTOR_ID_COOKIE_NAME, connectorId, {
      secure: config.isProductionEnv || !isLocal,
      domain: config.cookieDomain || undefined,
      path: "/",
      sameSite: isLocal && !config.isProductionEnv ? "lax" : "none",
      expires: Date.now() + SOCIAL_CONNECTOR_COOKIE_EXPIRATION_TIME_MS,
    })
  }
}

export const createSetPostLoginRedirectCookie = (config: AppConfig) => {
  return (postLoginRedirectPath: string) => {
    const isLocal = Boolean(config.baseUrl.includes("localhost"))
    cookies().set(
      LOGTO_POST_LOGIN_REDIRECT_URL_COOKIE_NAME,
      postLoginRedirectPath,
      {
        secure: config.isProductionEnv || !isLocal,
        domain: config.cookieDomain || undefined,
        path: "/",
        sameSite: isLocal && !config.isProductionEnv ? "lax" : "none",
        expires: Date.now() + PRE_LOGIN_COOKIE_EXPIRATION_TIME_MS,
      },
    )
  }
}

export const createConsumePostLoginRedirectCookie = (config: AppConfig) => {
  return (): string | undefined => {
    const value = cookies().get(
      LOGTO_POST_LOGIN_REDIRECT_URL_COOKIE_NAME,
    )?.value
    if (value) {
      // Delete with same domain/path that was used to set it
      if (config.cookieDomain) {
        cookies().delete({
          name: LOGTO_POST_LOGIN_REDIRECT_URL_COOKIE_NAME,
          domain: config.cookieDomain,
          path: "/",
        })
      } else {
        cookies().delete(LOGTO_POST_LOGIN_REDIRECT_URL_COOKIE_NAME)
      }
    }
    return value
  }
}

export const createDeleteAllCookies = (config: AppConfig) => {
  return () => {
    const _cookies = cookies()
    for (const { name } of _cookies.getAll()) {
      _cookies.delete(name)
      expireCookie(name, config)
      if (config.cookieDomain) {
        _cookies.delete({
          name,
          domain: config.cookieDomain,
          path: "/",
        })
        expireCookie(name, config, config.cookieDomain)
      }
    }
  }
}

export const createDeleteLogtoCookies = (config: AppConfig) => {
  return () => {
    const localCookies = cookies()
    for (const { name } of localCookies.getAll()) {
      if (name.startsWith("logto:")) {
        localCookies.delete(name)
        expireCookie(name, config)
        if (config.cookieDomain) {
          localCookies.delete({
            name,
            domain: config.cookieDomain,
            path: "/",
          })
          expireCookie(name, config, config.cookieDomain)
        }
      }
    }
  }
}

export const createSetPostGlobalSignoutCookie = (config: AppConfig) => {
  return (postRedirectUri: string) => {
    const isLocal = Boolean(config.baseUrl.includes("localhost"))
    cookies().set(POST_GLOBAL_SIGNOUT_COOKIE_NAME, postRedirectUri, {
      secure: config.isProductionEnv || !isLocal,
      domain: config.cookieDomain || undefined,
      path: "/",
      sameSite: isLocal && !config.isProductionEnv ? "lax" : "none",
      httpOnly: false, // Needs to be accessible by client for iframe-based logout
      maxAge: 60 * 5, // 5 minutes
    })
  }
}

export const createDeletePostGlobalSignoutCookie = (config: AppConfig) => {
  return () => {
    if (config.cookieDomain) {
      cookies().delete({
        name: POST_GLOBAL_SIGNOUT_COOKIE_NAME,
        domain: config.cookieDomain,
        path: "/",
      })
    } else {
      cookies().delete(POST_GLOBAL_SIGNOUT_COOKIE_NAME)
    }
  }
}
