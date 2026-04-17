import type { IdTokenClaims } from "@logto/next"
import {
  INACTIVE_PUBLIC_SERVANT_ORG_ROLE,
  ROLE_NAME_CITIZEN,
  ROLE_NAME_ONBOARDED_CITIZEN,
} from "./constants"

export const isInactivePublicServant = (orgRoles: string[] | null): boolean => {
  return orgRoles?.includes(INACTIVE_PUBLIC_SERVANT_ORG_ROLE) ?? false
}

export const isPublicServant = (
  orgRoles: string[] | null,
  publicServantExpectedRoles?: string[],
): boolean => {
  if (isInactivePublicServant(orgRoles) || orgRoles === null) return false
  return orgRoles.some((orgRole) => {
    const [, role] = orgRole.split(":")
    return (publicServantExpectedRoles ?? []).includes(role)
  })
}

export const isCitizen = (claims?: IdTokenClaims): boolean => {
  return Boolean(
    claims?.roles?.some(
      (role) =>
        role === ROLE_NAME_CITIZEN || role === ROLE_NAME_ONBOARDED_CITIZEN,
    ),
  )
}

export const isCitizenOnboarded = (claims?: IdTokenClaims): boolean => {
  return Boolean(
    claims?.roles?.some((role) => role === ROLE_NAME_ONBOARDED_CITIZEN),
  )
}
