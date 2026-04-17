import { type LogtoNextConfig, UserScope } from "@logto/next"
import type { AppConfig } from "./types"

export const createBuildLogtoConfig = (
  config: AppConfig,
): (() => LogtoNextConfig) => {
  const logtoConfig: LogtoNextConfig = {
    endpoint: config.logtoEndpoint,
    appId: config.appId,
    appSecret: config.appSecret,
    scopes: [
      UserScope.Organizations,
      UserScope.OrganizationRoles,
      UserScope.Roles,
      UserScope.CustomData,
      ...(config.scopes ?? []),
    ],
    resources: config.resources ?? [],
    cookieSecret: config.logtoCookieSecret,
    cookieSecure: config.isProductionEnv,
    baseUrl: config.baseUrl,
  }

  return (): LogtoNextConfig => logtoConfig
}
