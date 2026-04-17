import type { IdTokenClaims, LogtoContext, LogtoNextConfig } from "@logto/next"
import { getLogtoContext } from "@logto/next/server-actions"
import { deepClone } from "./deep-clone"
import { GetTokenError, NoOrganizationError } from "./get-token-error"
import type { Logger } from "./types"

const addAdditionalScopes = (
  config: LogtoNextConfig,
  additionalScopes: string[],
): LogtoNextConfig => {
  const outputConfig = deepClone(config)
  additionalScopes.forEach((scope) => {
    if (outputConfig.scopes && !outputConfig.scopes.includes(scope)) {
      outputConfig.scopes.push(scope)
    }
  })
  return outputConfig
}

export const createGetLogtoContextOrRedirect = (
  redirectToLogin: (url?: string | null) => never,
  logger: Logger,
  fetchUserInfo: boolean = false,
  additionalScopes: string[] = [],
) => {
  return async (config: LogtoNextConfig): Promise<LogtoContext> => {
    let logtoContext: LogtoContext = {
      isAuthenticated: false,
      claims: undefined,
    }
    try {
      logtoContext = await getLogtoContext(
        addAdditionalScopes(config, additionalScopes),
        { fetchUserInfo },
      )
    } catch (error) {
      logger.warn({ error }, "[AuthContext] Failed to get Logto context")
      logtoContext = { isAuthenticated: false, claims: undefined }
    }

    if (!logtoContext.isAuthenticated || !logtoContext.claims?.sub) {
      redirectToLogin()
    }

    return logtoContext
  }
}

/**
 * @param context The context got from Logto
 * @param organizationRoles The organization roles extracted from the context
 * @param requestedOrganizationId The organization id to return data for
 * @returns The details of the requeste organization, if available
 */
export const parseOrganizationInfo = (
  context: LogtoContext,
  organizationRoles: string[] | null,
):
  | Record<
      string,
      { id: string; name: string; roles: string[]; description: string }
    >
  | undefined => {
  if (organizationRoles === null || organizationRoles.length === 0) {
    return undefined
  }

  if (!context.userInfo?.organization_data) {
    return undefined
  }

  const rolesByOrg: Record<string, string[]> = {}
  // The organization role names are in format
  // orgId:roleName
  for (const role of organizationRoles) {
    const [orgId, roleName] = role.split(":")
    if (!rolesByOrg[orgId]) {
      rolesByOrg[orgId] = []
    }
    rolesByOrg[orgId].push(roleName)
  }

  const output: Record<
    string,
    { id: string; name: string; roles: string[]; description: string }
  > = {}
  for (const currentOrg of context.userInfo.organization_data) {
    output[currentOrg.id] = {
      id: currentOrg.id,
      name: currentOrg.name,
      roles: rolesByOrg[currentOrg.id] ?? [],
      description: currentOrg.description ?? "",
    }
  }

  return output
}

export const parseOrganizationRoles = (
  claims?: IdTokenClaims,
): string[] | null => {
  const organizationRoles: string[] = []
  if (claims && Array.isArray(claims.organization_roles)) {
    organizationRoles.push(...claims.organization_roles)
  }
  return organizationRoles.length > 0
    ? Array.from(new Set(organizationRoles))
    : null
}

export const createGetTokenOrRedirect = (
  getCachedUserToken: (userId: string | undefined) => Promise<string>,
  redirectToLogin: (url?: string | null) => never,
) => {
  return async (userId: string): Promise<string> => {
    try {
      return await getCachedUserToken(userId)
    } catch (error) {
      if (NoOrganizationError.isNoOrganizationError(error)) {
        redirectToLogin(error.redirectUrl)
      }
      if (GetTokenError.isGetTokenError(error)) {
        if (
          error.statusCode === 400 ||
          error.statusCode === 401 ||
          error.statusCode === 403
        ) {
          redirectToLogin()
        }
        throw error
      }
      throw error
    }
  }
}
