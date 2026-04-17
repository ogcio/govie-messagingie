import { SigninMethod } from "./types"

export const SOCIAL_CONNECTOR_COOKIE_EXPIRATION_TIME_MS = 1000 * 30 // 30 seconds
export const PRE_LOGIN_COOKIE_EXPIRATION_TIME_MS = 1000 * 60 * 5 // 5 minutes
export const DEFAULT_POST_LOGIN_REDIRECT_URL = "/"
export const CONNECTOR_MYGOVID = "mygovid"
export const CONNECTOR_ENTRAID = "ogcio-entraid"
export const ROLE_NAME_CITIZEN = "citizen"
export const ROLE_NAME_ONBOARDED_CITIZEN = "Onboarded citizen"
export const INACTIVE_PUBLIC_SERVANT_SCOPE = "bb:public-servant.inactive:*"
export const INACTIVE_PUBLIC_SERVANT_ORG_ROLE =
  "inactive-ps-org:Inactive Public Servant"
export const LOGTO_POST_LOGIN_REDIRECT_URL_COOKIE_NAME =
  "logtoPostLoginRedirectUrl"
export const LOGTO_SOCIAL_CONNECTOR_ID_COOKIE_NAME = "connectorsToShow"

export const POST_LOGIN_SEARCH_PARAMS = {
  LoginUrl: "loginUrl",
  PostLoginRedirectPath: "postLoginRedirectPath",
} as const

// Default allowed signin methods for backwards compatibility.
// Applications should now provide their own allowed list when
// configuring the authorisation instance.
export const DEFAULT_ALLOWED_SIGNIN_METHODS: readonly SigninMethod[] = [
  SigninMethod.MyGovId,
]

// Deprecated: use SigninMethod enum plus application-provided configuration.
export const ALLOWED_SIGNIN_METHODS = DEFAULT_ALLOWED_SIGNIN_METHODS
export const WRONG_LOGIN_RETURN_URL_PARAM = "returnUrl"
export const WRONG_LOGIN_METHOD_PATH = "/wrong-login-method-error"

// OIDC token verification
export const OIDC_JWKS_PATH = "/oidc/jwks"
export const OIDC_BASE_PATH = "/oidc"

// Logout / end-session
export const GLOBAL_SIGNOUT_PATH = "/global-signout"
export const POST_GLOBAL_SIGNOUT_PATH = "/post-global-signout"
export const POST_GLOBAL_SIGNOUT_COOKIE_NAME = "postGlobalSignoutUrl"
export const POST_REDIRECT_URI_PARAM = "postRedirectUri"
export const GLOBAL_SIGNOUT_ROLE_PARAM = "role"
export const GLOBAL_SIGNOUT_ROLE_CITIZEN = "citizen"
export const GLOBAL_SIGNOUT_ROLE_PUBLIC_SERVANT = "public-servant"
export const END_SESSION_POST_LOGOUT_REDIRECT_PARAM = "post_logout_redirect_uri"
export const SIGNOUT_PATH = "api/signout"
export const LOGTO_CALLBACK_PATH = "/api/callback"

// Onboarding
export const ONBOARDING_PATH = "/onboarding"
export const ONBOARDING_SOURCE_PARAM = "source"

export const SELECTED_ORG_COOKIE_NAME = "bb-selected-org-id"
