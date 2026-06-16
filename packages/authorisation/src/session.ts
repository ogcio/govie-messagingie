import type {
  IdTokenClaims,
  LogtoContext,
  LogtoNextConfig,
  UserInfoResponse,
} from "@logto/next"
import { getLogtoContext } from "@logto/next/server-actions"
import { parseOrganizationInfo, parseOrganizationRoles } from "./context"
import {
  isCitizen,
  isCitizenOnboarded,
  isInactivePublicServant,
  isPublicServant,
} from "./roles"
import { SelectedOrganizationHandler } from "./selected-organization-handler"
import { serializeErrorForLog } from "./serialize-error"
import { getUserSignInMethod } from "./token"
import type { AuthSessionContext, Logger } from "./types"

type Organization = { id: string; name: string; roles: string[] }

/**
 * Extracts the user ID from the Logto context claims.
 */
const getUserIdFromContext = (context: LogtoContext): string => {
  return (context.claims as IdTokenClaims).sub
}

/**
 * Parses organization data from the Logto context and returns a list of organizations.
 */
const getOrganizationList = (
  context: LogtoContext,
): { id: string; name: string; roles: string[]; description: string }[] => {
  const orgRoles = parseOrganizationRoles(context.claims)
  const organizationInfo = parseOrganizationInfo(context, orgRoles)
  return Object.values(organizationInfo ?? {})
}

/**
 * Gets the default organization from the list, using the selected organization ID if available.
 */
const getDefaultOrganization = <
  T extends { id: string; name: string; roles: string[] },
>(
  organizationList: T[],
): { id: string; name: string; roles: string[] } | undefined => {
  const organizationId = SelectedOrganizationHandler.get()
  const org =
    organizationList.find(({ id }) => id === organizationId) ??
    organizationList[0]
  return org ? { id: org.id, name: org.name, roles: org.roles } : undefined
}

/**
 * Maps organizations to a simplified format without description.
 */
const mapOrganizations = <
  T extends { id: string; name: string; roles: string[] },
>(
  organizationList: T[],
): Organization[] => {
  return organizationList.map(({ id, name, roles }) => ({
    id,
    name,
    roles,
  }))
}

export const createGetAuthSessionContext = (
  getLogtoContextOrRedirect: (config: LogtoNextConfig) => Promise<LogtoContext>,
  getTokenOrRedirect: (userId: string) => Promise<string>,
  publicServantExpectedRoles?: string[],
  requireOrganizations = true,
) => {
  return async (config: LogtoNextConfig): Promise<AuthSessionContext> => {
    const context: LogtoContext = await getLogtoContextOrRedirect(config)
    const userId = getUserIdFromContext(context)
    const token = await getTokenOrRedirect(userId)

    const organizationList = getOrganizationList(context)
    const orgRoles = parseOrganizationRoles(context.claims)
    const defaultOrganization = getDefaultOrganization(organizationList)

    if (!defaultOrganization && requireOrganizations) {
      throw new Error("No organizations found for the current user")
    }

    const organizations =
      organizationList.length > 0 ? mapOrganizations(organizationList) : []

    return {
      isCitizen: isCitizen(context.claims),
      isCitizenOnboarded: isCitizenOnboarded(context.claims),
      isPublicServant: isPublicServant(orgRoles, publicServantExpectedRoles),
      isInactivePublicServant: isInactivePublicServant(orgRoles),
      signinMethod: getUserSignInMethod(token),
      userId,
      userInfo: context.userInfo as UserInfoResponse | undefined,
      currentOrganization: defaultOrganization ?? null,
      organizations,
    }
  }
}

export const createGetAuthSessionOrganizations = (
  getLogtoContextOrRedirect: (config: LogtoNextConfig) => Promise<LogtoContext>,
  requireOrganizations = true,
) => {
  return async (
    config: LogtoNextConfig,
  ): Promise<{
    userId: string
    currentOrganization: { id: string; name: string; roles: string[] } | null
    organizations: { id: string; name: string; roles: string[] }[]
  }> => {
    const context: LogtoContext = await getLogtoContextOrRedirect(config)
    const userId = getUserIdFromContext(context)

    const organizationList = getOrganizationList(context)
    const defaultOrganization = getDefaultOrganization(organizationList)
    const organizations =
      organizationList.length > 0 ? mapOrganizations(organizationList) : []

    if (!defaultOrganization && requireOrganizations) {
      throw new Error("No organizations found for the current user")
    }

    return {
      userId,
      currentOrganization: defaultOrganization ?? null,
      organizations,
    }
  }
}

export const createGetAuthSessionUserId = (
  getLogtoContextOrRedirect: (config: LogtoNextConfig) => Promise<LogtoContext>,
) => {
  return async (config: LogtoNextConfig): Promise<{ userId: string }> => {
    const context = await getLogtoContextOrRedirect(config)
    return { userId: getUserIdFromContext(context) }
  }
}

/**
 * Get auth session context without redirecting if not authenticated.
 * Useful for layouts that need to work for both authenticated and unauthenticated users.
 * Returns null if user is not authenticated.
 */
export const createGetAuthSessionContextOptional = (
  getCachedUserToken: (userId: string | undefined) => Promise<string>,
  publicServantExpectedRoles: string[] | undefined,
  logger: Logger,
  requireOrganizations = true,
) => {
  return async (
    config: LogtoNextConfig,
  ): Promise<AuthSessionContext | null> => {
    try {
      const context = await getLogtoContext(config)

      if (!context.isAuthenticated || !context.claims?.sub) {
        return null
      }

      const userId = getUserIdFromContext(context)
      let token: string | undefined
      try {
        token = await getCachedUserToken(userId)
      } catch (error) {
        logger.warn(
          { error: serializeErrorForLog(error) },
          "[GetAuthSessionContextOptional] Failed to get token",
        )
        // Continue without token - we can still provide partial session info
      }

      const organizationList = getOrganizationList(context)
      const orgRoles = parseOrganizationRoles(context.claims)
      const defaultOrganization = getDefaultOrganization(organizationList)
      const organizations =
        organizationList.length > 0 ? mapOrganizations(organizationList) : []

      if (!defaultOrganization && requireOrganizations) {
        return null
      }

      return {
        isCitizen: isCitizen(context.claims),
        isCitizenOnboarded: isCitizenOnboarded(context.claims),
        isPublicServant: isPublicServant(orgRoles, publicServantExpectedRoles),
        isInactivePublicServant: isInactivePublicServant(orgRoles),
        signinMethod: token ? getUserSignInMethod(token) : undefined,
        userId,
        userInfo: context.userInfo as UserInfoResponse | undefined,
        currentOrganization: defaultOrganization ?? null,
        organizations,
      }
    } catch (error) {
      logger.warn(
        { error: serializeErrorForLog(error) },
        "[GetAuthSessionContextOptional] Error getting context",
      )
      return null
    }
  }
}
