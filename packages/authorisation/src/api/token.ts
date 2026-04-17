import type { LogtoRequestError } from "@logto/node"
import { NextResponse } from "next/server"
import { SelectedOrganizationHandler } from "../selected-organization-handler"
import { getUserAccessToken } from "../token"
import type { AuthSessionContext, ConfigFactory, Logger } from "../types"

export const createTokenHandler = (
  resource: string,
  configFactory: ConfigFactory,
  logger: Logger,
) => {
  return async () => {
    try {
      const token = await getUserAccessToken(configFactory(), resource)
      return NextResponse.json({ token })
    } catch (error) {
      const errorName = (error as { name?: string }).name
      const errorConstructorName = (
        error as { constructor?: { name?: string } }
      ).constructor?.name

      logger.info(
        { errorName, errorConstructorName },
        "[TokenRoute] Error detection diagnostic",
      )

      if (isLogtoRequestError(error)) {
        // Expected: session expired or refresh token rotated — redirect to login, not a server error.
        logger.warn(
          { errorCode: error.code },
          "[TokenRoute] Logto session invalid, returning 401",
        )
        return NextResponse.json(
          { error: error.code || "Authentication error" },
          { status: 401 },
        )
      }

      logger.error(
        { error },
        "[TokenRoute] Unexpected error while getting token",
      )
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      )
    }
  }
}

const NO_ORGANIZATIONS_MESSAGE = "No organizations found for the current user"

export const createOrganizationTokenHandler = (
  configFactory: ConfigFactory,
  logger: Logger,
  getAuthSessionOrganizations: (
    config: ReturnType<ConfigFactory>,
  ) => Promise<
    Pick<AuthSessionContext, "userId" | "organizations" | "currentOrganization">
  >,
  getCachedOrganizationToken: (
    userId: string | undefined,
    organizationId: string | undefined,
  ) => Promise<string>,
  isProductionEnv: boolean,
  cookieDomain?: string,
  citizenRedirectUrl?: string,
) => {
  return async () => {
    try {
      const config = configFactory()
      let userId: string | undefined
      let organizationId = SelectedOrganizationHandler.get()

      // If cookie is not set, get the default organization from auth context and set it
      if (!organizationId) {
        const { userId: resolvedUserId, currentOrganization } =
          await getAuthSessionOrganizations(config)
        userId = resolvedUserId
        organizationId = currentOrganization?.id ?? undefined

        if (organizationId) {
          // Set the cookie in the API route handler (where cookies can be modified)
          SelectedOrganizationHandler.set(
            organizationId,
            isProductionEnv,
            true, // overwrite existing
            cookieDomain,
          )
        }
      }

      if (!organizationId) {
        throw new Error("Organization ID not found")
      }

      if (!userId) {
        const { userId: resolvedUserId } =
          await getAuthSessionOrganizations(config)
        userId = resolvedUserId
      }

      const token = await getCachedOrganizationToken(userId, organizationId)
      return NextResponse.json({ token })
    } catch (error) {
      if (
        citizenRedirectUrl &&
        error instanceof Error &&
        error.message === NO_ORGANIZATIONS_MESSAGE
      ) {
        return NextResponse.json(
          { error: "no_organization", redirectUrl: citizenRedirectUrl },
          { status: 403 },
        )
      }
      const cause =
        error &&
        typeof error === "object" &&
        "cause" in error &&
        (error as { cause: unknown }).cause
      const err =
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
              cause:
                cause instanceof Error
                  ? { name: cause.name, message: cause.message }
                  : cause,
            }
          : error
      logger.error(
        { error: err },
        "[OrganizationTokenRoute] Error while getting token",
      )
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      )
    }
  }
}

function isLogtoRequestError(error: unknown): error is LogtoRequestError {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: string }).name === "LogtoRequestError"
  )
}
