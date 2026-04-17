import * as apiAfterLogin from "./api/after-login"
import * as apiApplicationSignout from "./api/application-signout"
import * as apiHandlers from "./api/callback"
import * as apiPreLogin from "./api/pre-login"
import * as apiPreSignout from "./api/pre-signout"
import * as apiSignout from "./api/signout"
import * as apiToken from "./api/token"
import { createBuildLogtoConfig } from "./config"
import { DEFAULT_ALLOWED_SIGNIN_METHODS } from "./constants"
import * as context from "./context"
import * as cookies from "./cookies"
import * as currentRequest from "./current-request"
import * as flows from "./flows"
import * as redirects from "./redirects"
import * as roles from "./roles"
import * as session from "./session"
import * as token from "./token"
import type {
  AppConfig,
  ConsentSubject,
  CustomHeaders,
  Logger,
  ProfileClientFactory,
  ProfilePayload,
  RedisConnection,
  Routes,
} from "./types"
import * as urlBuilders from "./url-builders"

export type AuthorisationFactoryParams = {
  config: AppConfig
  logger: Logger
  redisConnection: RedisConnection
  routes: Routes
  customHeaders: CustomHeaders
  tokenServiceName: string
  profileClient: ProfileClientFactory
  consentSubject?: ConsentSubject
  fetchUserInfo?: boolean
  additionalScopes?: string[]
  customSetSocialConnectorCookie?: (connectorId?: string) => void
  customPreLogoutRedirect?: () => never | Promise<never>
  /**
   * Optional list of allowed signin methods for this application.
   * If not provided, a sensible default is used.
   */
  allowedSigninMethods?: readonly string[]
}

export const createAuthorisation = <
  TProfilePayload extends ProfilePayload = ProfilePayload,
>(
  params: AuthorisationFactoryParams,
) => {
  const {
    config,
    logger,
    redisConnection,
    routes,
    customHeaders,
    tokenServiceName,
    profileClient,
    consentSubject,
    fetchUserInfo,
    additionalScopes,
    customSetSocialConnectorCookie,
    customPreLogoutRedirect,
    allowedSigninMethods,
  } = params

  const effectiveAllowedSigninMethods =
    allowedSigninMethods ?? DEFAULT_ALLOWED_SIGNIN_METHODS

  // Create config factory
  const buildLogtoConfig = createBuildLogtoConfig(config)

  // Create cookie functions
  const setSocialConnectorCookie =
    customSetSocialConnectorCookie ??
    cookies.createSetSocialConnectorCookie(config)
  const setPostLoginRedirectCookie =
    cookies.createSetPostLoginRedirectCookie(config)
  const consumePostLoginRedirectCookie =
    cookies.createConsumePostLoginRedirectCookie(config)
  const deleteAllCookies = cookies.createDeleteAllCookies(config)
  const deleteLogtoCookies = cookies.createDeleteLogtoCookies(config)
  const setPostGlobalSignoutCookie =
    cookies.createSetPostGlobalSignoutCookie(config)
  const deletePostGlobalSignoutCookie =
    cookies.createDeletePostGlobalSignoutCookie(config)

  // Create redirect functions
  const redirectToLogin = redirects.createRedirectToLogin(
    config,
    customHeaders,
    routes,
  )
  const buildLoginUrlWithPostLoginRedirect =
    redirects.createBuildLoginUrlWithPostLoginRedirect(
      config,
      customHeaders,
      routes,
    )
  const getLoginUrlWithCustomPostLoginRedirect =
    redirects.createGetLoginUrlWithCustomPostLoginRedirect(config, routes)
  const preLogoutRedirect =
    customPreLogoutRedirect ?? redirects.createPreLogoutRedirect(config)

  // Create current request functions
  const getCurrentPath = currentRequest.createGetCurrentPath(customHeaders)
  const getCurrentSearch = currentRequest.createGetCurrentSearch(customHeaders)
  const getCurrentAbsoluteUrl =
    currentRequest.createGetCurrentAbsoluteUrl(customHeaders)

  // Create token functions
  const getCachedUserToken = token.createGetCachedUserToken(
    config,
    redisConnection,
    logger,
    buildLogtoConfig,
    tokenServiceName,
  )
  const getCachedOrganizationToken = token.createGetCachedOrganizationToken(
    redisConnection,
    logger,
    buildLogtoConfig,
    tokenServiceName,
  )
  const invalidateCachedUserToken = token.createInvalidateCachedUserToken(
    redisConnection,
    tokenServiceName,
  )
  const getSigninMethodRSC = token.createGetSigninMethodRSC(
    buildLogtoConfig,
    logger,
  )

  // Create context functions
  const getLogtoContextOrRedirect = context.createGetLogtoContextOrRedirect(
    redirectToLogin,
    logger,
    fetchUserInfo,
    additionalScopes,
  )
  const getTokenOrRedirect = context.createGetTokenOrRedirect(
    getCachedUserToken,
    redirectToLogin,
  )

  // Organization data is only needed when:
  // - the app is a public servant app, and
  // - we actually fetch userInfo (where org data lives).
  // Citizen apps that don't request userInfo won't be forced to have org data.
  const requireOrganizations = Boolean(
    (config.isPublicServant ?? false) && fetchUserInfo,
  )

  // Create session functions
  const getAuthSessionContext = session.createGetAuthSessionContext(
    getLogtoContextOrRedirect,
    getTokenOrRedirect,
    config.publicServantExpectedRoles,
    requireOrganizations,
  )
  const getAuthSessionOrganizations = session.createGetAuthSessionOrganizations(
    getLogtoContextOrRedirect,
    requireOrganizations,
  )
  const getAuthSessionUserId = session.createGetAuthSessionUserId(
    getLogtoContextOrRedirect,
  )
  const getAuthSessionContextOptional =
    session.createGetAuthSessionContextOptional(
      getCachedUserToken,
      config.publicServantExpectedRoles,
      logger,
      requireOrganizations,
    )

  // Create URL builders
  const buildWrongLoginMethodRedirect =
    urlBuilders.createBuildWrongLoginMethodRedirect(
      config,
      getLoginUrlWithCustomPostLoginRedirect,
    )
  const buildOnboardingRedirectUrl =
    urlBuilders.createBuildOnboardingRedirectUrl(
      config,
      getLoginUrlWithCustomPostLoginRedirect,
    )

  // Create flow functions
  const preLogin = flows.createPreLogin(
    config,
    setSocialConnectorCookie,
    setPostLoginRedirectCookie,
    redirectToLogin,
  )
  const login = flows.createLogin(config, buildLogtoConfig)
  const preLogout = flows.createPreLogout(preLogoutRedirect)
  const logout = flows.createLogout(
    config,
    deleteAllCookies,
    invalidateCachedUserToken,
    getAuthSessionUserId,
    redirectToLogin,
    buildLogtoConfig,
    logger,
    setPostGlobalSignoutCookie,
  )
  const applicationLogout = flows.createApplicationLogout(deleteLogtoCookies)
  const loginCallback = flows.createLoginCallback(
    config,
    consumePostLoginRedirectCookie,
    redirectToLogin,
    buildLogtoConfig,
  )
  const globalSignoutAction = flows.createGlobalSignoutAction(
    config,
    buildLogtoConfig,
  )
  const postGlobalSignoutLoader = flows.createPostGlobalSignoutLoader(
    config,
    deletePostGlobalSignoutCookie,
  )
  const getCitizenProfileOrRedirect =
    flows.createGetCitizenProfileOrRedirect<TProfilePayload>(
      config,
      getLogtoContextOrRedirect,
      getAuthSessionContext,
      getCurrentPath,
      buildWrongLoginMethodRedirect,
      buildOnboardingRedirectUrl,
      invalidateCachedUserToken,
      redirectToLogin,
      profileClient,
      consentSubject,
      buildLogtoConfig,
      logger,
      effectiveAllowedSigninMethods,
    )
  const getPublicServantProfileOrRedirect =
    flows.createGetPublicServantProfileOrRedirect<TProfilePayload>(
      config,
      getAuthSessionContext,
      profileClient,
      consentSubject,
      buildLogtoConfig,
      logger,
    )

  // Create API handlers
  const callbackHandler = apiHandlers.createCallbackHandler(loginCallback)
  const preLoginHandler = apiPreLogin.createPreLoginHandler(preLogin)
  const preSignoutHandler = apiPreSignout.createPreSignoutHandler(preLogout)
  const signoutHandler = apiSignout.createSignoutHandler(logout)
  const applicationSignoutHandler =
    apiApplicationSignout.createApplicationSignoutHandler(applicationLogout)
  const tokenHandler = (resource: string) =>
    apiToken.createTokenHandler(resource, buildLogtoConfig, logger)
  const organizationTokenHandler = apiToken.createOrganizationTokenHandler(
    buildLogtoConfig,
    logger,
    getAuthSessionOrganizations,
    getCachedOrganizationToken,
    config.isProductionEnv,
    config.cookieDomain,
    config.citizenRedirectUrl,
  )
  const afterLoginHandler = apiAfterLogin.createAfterLoginHandler(login)

  return {
    // Config
    buildLogtoConfig,
    // Cookies
    setSocialConnectorCookie,
    setPostLoginRedirectCookie,
    consumePostLoginRedirectCookie,
    deleteAllCookies,
    deleteLogtoCookies,
    setPostGlobalSignoutCookie,
    deletePostGlobalSignoutCookie,
    // Redirects
    redirectToLogin,
    buildLoginUrlWithPostLoginRedirect,
    getLoginUrlWithCustomPostLoginRedirect,
    preLogoutRedirect,
    // Current request
    getCurrentPath,
    getCurrentSearch,
    getCurrentAbsoluteUrl,
    // Token
    getUserAccessToken: token.getUserAccessToken,
    getUserSignInMethod: token.getUserSignInMethod,
    getSigninMethodRSC,
    getCachedUserToken,
    getCachedOrganizationToken,
    invalidateCachedUserToken,
    // Context
    getLogtoContextOrRedirect,
    getTokenOrRedirect,
    parseOrganizationRoles: context.parseOrganizationRoles,
    // Session
    getAuthSessionContext,
    getAuthSessionUserId,
    getAuthSessionContextOptional,
    getAuthSessionOrganizations,
    // Roles
    isInactivePublicServant: roles.isInactivePublicServant,
    isPublicServant: roles.isPublicServant,
    isCitizen: roles.isCitizen,
    isCitizenOnboarded: roles.isCitizenOnboarded,
    // URL builders
    buildWrongLoginMethodRedirect,
    buildOnboardingRedirectUrl,
    // Flows
    preLogin,
    login,
    preLogout,
    logout,
    applicationLogout,
    loginCallback,
    globalSignoutAction,
    postGlobalSignoutLoader,
    getCitizenProfileOrRedirect,
    getPublicServantProfileOrRedirect,
    // API Handlers
    api: {
      callback: callbackHandler,
      preLogin: preLoginHandler,
      preSignout: preSignoutHandler,
      signout: signoutHandler,
      applicationSignout: applicationSignoutHandler,
      token: tokenHandler,
      organizationToken: organizationTokenHandler,
      afterLogin: afterLoginHandler,
    },
  }
}

// Export the return type for proper typing
export type Authorisation<
  TProfilePayload extends ProfilePayload = ProfilePayload,
> = ReturnType<typeof createAuthorisation<TProfilePayload>>
