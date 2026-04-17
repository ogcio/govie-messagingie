import type { LogtoNextConfig, UserInfoResponse } from "@logto/next"

export enum SigninMethod {
  MyGovId = "social:mygovid",
  EntraID = "social:ogcio-entraid",
}

export type AuthSessionContext = {
  signinMethod: string | undefined
  isCitizen: boolean
  isCitizenOnboarded: boolean
  isPublicServant: boolean
  isInactivePublicServant: boolean
  userId: string
  userInfo: UserInfoResponse | undefined
  currentOrganization: { id: string; name: string; roles: string[] } | null
  organizations: { id: string; name: string; roles: string[] }[]
}

export type ConfigFactory = () => LogtoNextConfig

// Dependencies that need to be injected from the app
export type AppConfig = {
  resources?: string[]
  scopes: string[]
  baseUrl: string
  appId: string
  appSecret: string
  logtoCookieSecret: string
  logtoEndpoint: string
  isProductionEnv: boolean
  profileUrl: string
  /**
   * URL to redirect public servants when they visit this citizen app
   * (e.g. messaging admin URL for the messaging citizen app).
   */
  publicServantRedirectUrl: string
  /**
   * When set, users with no organization (e.g. citizens on the admin app)
   * are redirected here instead of seeing an error. Use the citizen app URL
   * (e.g. messaging app) for the admin app.
   */
  citizenRedirectUrl?: string
  myGovIdEndSessionUrl: string
  cookieDomain?: string
  publicServantExpectedRoles?: string[]
  globalSignoutRole?: string
  /**
   * Indicates if the current application is a public servant (admin) application.
   * When true, pre-login URLs may include an additional "admin" query parameter.
   */
  isPublicServant?: boolean
  /**
   * When true, only MyGovID connector is used in local development.
   * Used to skip Entra ID connector locally when set to true.
   */
  useGovIdOnly?: boolean
}

export type Logger = {
  error: (obj: unknown, message: string) => void
  warn: (obj: unknown, message: string) => void
  info: (obj: unknown, message: string) => void
}

export type RedisConnection = {
  getToken: (params: {
    userId?: string
    serviceName: string
    organizationId?: string
    getTokenFn: (serviceName: string) => Promise<string>
    logger?: Logger
  }) => Promise<string>
  deleteToken: (params: {
    userId?: string
    serviceName: string
    organizationId?: string
  }) => Promise<void>
}

export type Routes = {
  logtoLogin: { url: string }
  preLogin: { url: string }
}

export type CustomHeaders = {
  Pathname: string
  Search: string
}

// Generic type for profile - apps will provide their own type
export type ProfilePayload = unknown

export type ProfileClient = {
  getProfile: (
    userId: string,
    ...args: unknown[]
  ) => Promise<{ data?: ProfilePayload; error?: unknown }>
}

export type ProfileClientFactory = () => ProfileClient

export type ConsentSubject = string

export type SelectedOrganization = {
  set(
    organizationId: string,
    secure: boolean,
    overwrite?: boolean,
    domain?: string,
  ): void
  get(): string | undefined
  delete(): void
  isSet(): boolean
}
