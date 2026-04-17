import type { LogtoContext } from "@logto/next"
import { handleSignIn, signIn, signOut } from "@logto/next/server-actions"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { NextResponse } from "next/server"
import {
  ALLOWED_SIGNIN_METHODS,
  CONNECTOR_ENTRAID,
  CONNECTOR_MYGOVID,
  GLOBAL_SIGNOUT_PATH,
  GLOBAL_SIGNOUT_ROLE_CITIZEN,
  GLOBAL_SIGNOUT_ROLE_PARAM,
  LOGTO_CALLBACK_PATH,
  POST_GLOBAL_SIGNOUT_COOKIE_NAME,
  POST_GLOBAL_SIGNOUT_PATH,
  POST_REDIRECT_URI_PARAM,
} from "./constants"
import { parseOrganizationRoles } from "./context"
import { parsePreLoginParams } from "./search-params"
import type {
  AppConfig,
  ConfigFactory,
  ConsentSubject,
  Logger,
  ProfileClientFactory,
  ProfilePayload,
} from "./types"

const safeDecodeURIComponent = (value: string): string => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const fetchProfileOrThrow = async <TProfilePayload>(
  profileClientFactory: ProfileClientFactory,
  userId: string,
  consentSubject: ConsentSubject | undefined,
  logger: Logger,
): Promise<TProfilePayload> => {
  const profileClient = profileClientFactory()
  const profile = await profileClient.getProfile(
    userId,
    undefined,
    undefined,
    consentSubject ? [consentSubject] : undefined,
  )

  if (profile.error) {
    logger.error(
      { error: profile.error, userId: `${userId.substring(0, 5)}...` },
      "Profile fetch error",
    )
    throw new Error("Failed to fetch profile")
  }

  if (!profile.data) {
    logger.error(
      {
        error: { message: "profile not found" },
        userId: `${userId.substring(0, 5)}...`,
      },
      "Profile not found",
    )
    throw new Error("Profile not found")
  }

  return profile.data as TProfilePayload
}

export const createPreLogin = (
  config: AppConfig,
  setSocialConnectorCookie: (connectorId?: string) => void,
  setPostLoginRedirectCookie: (path: string) => void,
  redirectToLogin: (url?: string | null) => never,
) => {
  return async (searchParams: URLSearchParams): Promise<void> => {
    const { postLoginRedirectPath, loginUrl } =
      parsePreLoginParams(searchParams)

    // Messaging-specific: determine which connector to use based on admin param
    const isLocal = Boolean(config.baseUrl.includes("localhost"))
    const skipAdminConnectorLocally =
      isLocal && config.useGovIdOnly && !config.isProductionEnv

    let connectorId = CONNECTOR_MYGOVID
    if (searchParams.get("admin") && !skipAdminConnectorLocally) {
      connectorId = CONNECTOR_ENTRAID
    }

    setSocialConnectorCookie(connectorId)
    if (postLoginRedirectPath && postLoginRedirectPath.trim().length > 0) {
      setPostLoginRedirectCookie(safeDecodeURIComponent(postLoginRedirectPath))
    }
    redirectToLogin(loginUrl)
  }
}

export const createLogin = (
  config: AppConfig,
  configFactory: ConfigFactory,
) => {
  return async (): Promise<void> => {
    const callbackUrl = new URL(LOGTO_CALLBACK_PATH, config.baseUrl)
    return signIn(configFactory(), callbackUrl.toString())
  }
}

export const createPreLogout = (
  preLogoutRedirect: () => never | Promise<never>,
) => {
  return async (): Promise<void> => {
    await preLogoutRedirect()
  }
}

export const createLogout = (
  config: AppConfig,
  deleteAllCookies: () => void,
  invalidateCachedUserToken: (userId: string) => Promise<void>,
  getAuthSessionUserId: (
    config: ReturnType<ConfigFactory>,
  ) => Promise<{ userId: string }>,
  redirectToLogin: (url?: string | null) => never,
  configFactory: ConfigFactory,
  logger: Logger,
  setPostGlobalSignoutCookie: (postRedirectUri: string) => void,
) => {
  return async (redirectUrl?: string): Promise<void> => {
    // Get userId BEFORE deleting cookies, otherwise getAuthSessionUserId will redirect
    // invalidating because between logout and next login,
    // the userId scopes might be different
    try {
      const { userId } = await getAuthSessionUserId(configFactory())
      await invalidateCachedUserToken(userId)
    } catch (error) {
      // Next.js redirects throw errors with a digest starting with "NEXT_REDIRECT"
      // This is expected during logout if the session is already invalid, so we don't log it
      const digestValue =
        error && typeof error === "object" && "digest" in error
          ? (error as { digest?: unknown }).digest
          : undefined

      // `digest` is usually a string, but we defensively coerce anything string-like
      // (we've seen cases where it serializes as a string but fails `typeof === "string"`).
      const digest =
        typeof digestValue === "string"
          ? digestValue
          : digestValue &&
              typeof (digestValue as { toString?: unknown }).toString ===
                "function"
            ? String(digestValue)
            : undefined

      const isRedirectError =
        typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")

      if (!isRedirectError) {
        logger.warn(
          { error },
          "Failed to invalidate cached user token during logout",
        )
      }
    }
    deleteAllCookies()
    const postRedirectUri = redirectUrl || config.baseUrl
    // Set the post-global-signout cookie AFTER deleting all cookies
    // This cookie needs to survive to redirect after MyGovID logout
    setPostGlobalSignoutCookie(postRedirectUri)
    const globalSignoutURL = new URL(GLOBAL_SIGNOUT_PATH, config.profileUrl)
    globalSignoutURL.searchParams.set(POST_REDIRECT_URI_PARAM, postRedirectUri)
    globalSignoutURL.searchParams.set(
      GLOBAL_SIGNOUT_ROLE_PARAM,
      config.globalSignoutRole || GLOBAL_SIGNOUT_ROLE_CITIZEN,
    )
    redirectToLogin(globalSignoutURL.toString())
  }
}

export const createApplicationLogout = (deleteLogtoCookies: () => void) => {
  return async (): Promise<NextResponse> => {
    const cookieStore = cookies()
    const response = NextResponse.json({})

    for (const { name } of cookieStore.getAll()) {
      if (name.startsWith("logto:")) {
        response.cookies.set(name, "", {
          maxAge: 0,
          expires: new Date(0),
          path: "/",
        })
      }
    }

    deleteLogtoCookies()
    return response
  }
}

export const createGlobalSignoutAction = (
  config: AppConfig,
  configFactory: ConfigFactory,
) => {
  return async (): Promise<void> => {
    const postGlobalSignoutUrl = new URL(
      POST_GLOBAL_SIGNOUT_PATH,
      config.baseUrl,
    )
    // Use Logto's signOut which properly terminates the Logto session
    // and redirects to the IDP end-session with post_logout_redirect_uri
    await signOut(configFactory(), postGlobalSignoutUrl.toString())
  }
}

export const createPostGlobalSignoutLoader = (
  config: AppConfig,
  deletePostGlobalSignoutCookie: () => void,
) => {
  return async (): Promise<void> => {
    const cookieStore = cookies()
    const postGlobalSignoutUrl = cookieStore.get(
      POST_GLOBAL_SIGNOUT_COOKIE_NAME,
    )?.value

    if (postGlobalSignoutUrl) {
      const url = new URL(postGlobalSignoutUrl)
      // Delete with proper domain for production
      deletePostGlobalSignoutCookie()
      redirect(url.toString())
    }

    redirect(config.baseUrl)
  }
}

export const createLoginCallback = (
  config: AppConfig,
  consumePostLoginRedirectCookie: () => string | undefined,
  redirectToLogin: (url?: string | null) => never,
  configFactory: ConfigFactory,
) => {
  return async (searchParams: URLSearchParams): Promise<void> => {
    const callbackUrl = new URL(LOGTO_CALLBACK_PATH, config.baseUrl)
    searchParams.forEach((value, key) => {
      callbackUrl.searchParams.set(key, value)
    })

    await handleSignIn(configFactory(), callbackUrl)
    let postRedirectUrl = consumePostLoginRedirectCookie()

    if (!postRedirectUrl || postRedirectUrl.trim().length === 0) {
      postRedirectUrl = config.baseUrl
    }

    redirectToLogin(postRedirectUrl)
  }
}

export const createGetCitizenProfileOrRedirect = <
  TProfilePayload extends ProfilePayload,
>(
  config: AppConfig,
  getLogtoContextOrRedirect: (
    config: ReturnType<ConfigFactory>,
  ) => Promise<LogtoContext>,
  getAuthSessionContext: (
    config: ReturnType<ConfigFactory>,
  ) => Promise<import("./types").AuthSessionContext>,
  getCurrentPath: () => string,
  buildWrongLoginMethodRedirect: (currentPath?: string) => string,
  buildOnboardingRedirectUrl: (pathname: string) => string,
  invalidateCachedUserToken: (userId: string) => Promise<void>,
  redirectToLogin: (url?: string | null) => never,
  profileClientFactory: ProfileClientFactory,
  consentSubject: ConsentSubject | undefined,
  configFactory: ConfigFactory,
  logger: Logger,
  allowedSigninMethods: readonly string[] = ALLOWED_SIGNIN_METHODS,
) => {
  return async (): Promise<{
    profile: TProfilePayload
  }> => {
    // Early PS check from Logto claims — no token fetch needed.
    // Any user with org membership is a PS (active or inactive); citizens have
    // zero org roles. This is reliable across dev environments where a test user
    // may hold both a "citizen" user-role and PS org roles simultaneously.
    const logtoContext = await getLogtoContextOrRedirect(configFactory())
    if (parseOrganizationRoles(logtoContext.claims) !== null) {
      redirectToLogin(config.publicServantRedirectUrl)
    }

    // Full session setup (includes token fetch) — only reached by citizens.
    const { userId, isCitizenOnboarded, signinMethod } =
      await getAuthSessionContext(configFactory())

    if (typeof signinMethod !== "undefined") {
      if (!(allowedSigninMethods as readonly string[]).includes(signinMethod)) {
        const url = buildWrongLoginMethodRedirect(getCurrentPath() || undefined)
        redirectToLogin(url)
      }
    }

    if (!isCitizenOnboarded) {
      const onboardingUrl = buildOnboardingRedirectUrl(getCurrentPath())

      // TODO: invalidate cached token after onboarding is complete
      // at the moment we do it here because is the simplest way
      await invalidateCachedUserToken(userId)

      redirectToLogin(onboardingUrl)
    }

    const profile = await fetchProfileOrThrow<TProfilePayload>(
      profileClientFactory,
      userId,
      consentSubject,
      logger,
    )
    return { profile }
  }
}

export const createGetPublicServantProfileOrRedirect = <
  TProfilePayload extends ProfilePayload,
>(
  config: AppConfig,
  getAuthSessionContext: (
    config: ReturnType<ConfigFactory>,
  ) => Promise<import("./types").AuthSessionContext>,
  profileClientFactory: ProfileClientFactory,
  consentSubject: ConsentSubject | undefined,
  configFactory: ConfigFactory,
  logger: Logger,
) => {
  return async (options?: {
    inactivePublicServantRedirectUrl?: string
  }): Promise<{
    profile: TProfilePayload
    isInactivePublicServant: boolean
    organizations: { id: string; name: string; roles: string[] }[]
    currentOrganization: { id: string; name: string; roles: string[] }
  }> => {
    const {
      userId,
      isPublicServant,
      isInactivePublicServant,
      currentOrganization,
      organizations,
    } = await getAuthSessionContext(configFactory())

    if (!isPublicServant) {
      logger.warn(
        { userId: `${userId.substring(0, 5)}...` },
        "User is not a public servant, redirecting to citizen app",
      )
      if (config.citizenRedirectUrl) {
        redirect(config.citizenRedirectUrl)
      }
      throw new Error("Access forbidden: User is not a public servant")
    }

    if (isInactivePublicServant && options?.inactivePublicServantRedirectUrl) {
      redirect(options.inactivePublicServantRedirectUrl)
    }

    const profile = await fetchProfileOrThrow<TProfilePayload>(
      profileClientFactory,
      userId,
      consentSubject,
      logger,
    )

    if (!currentOrganization) {
      logger.warn(
        { userId: `${userId.substring(0, 5)}...` },
        "Missing current organization for public servant",
      )
      throw new Error("Missing current organization for public servant")
    }

    return {
      profile,
      isInactivePublicServant,
      organizations,
      currentOrganization,
    }
  }
}
