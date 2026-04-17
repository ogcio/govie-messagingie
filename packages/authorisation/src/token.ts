import type { LogtoNextConfig } from "@logto/next"
import {
  getAccessToken,
  getAccessTokenRSC,
  getOrganizationToken,
} from "@logto/next/server-actions"
import { createRemoteJWKSet, decodeJwt, type JWTPayload, jwtVerify } from "jose"
import { headers } from "next/headers"
import { GetTokenError, NoOrganizationError } from "./get-token-error"
import type { AppConfig, ConfigFactory, Logger, RedisConnection } from "./types"

function normalizeRedisTokenError(error: unknown): never {
  if (GetTokenError.isGetTokenError(error)) {
    throw error
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof (error as { statusCode?: number }).statusCode === "number" &&
    [400, 401, 403].includes((error as { statusCode: number }).statusCode)
  ) {
    throw new GetTokenError("Failed to retrieve token", 400)
  }

  throw error
}

function assertUserId(userId: string | undefined): asserts userId is string {
  if (!userId) {
    throw new Error("Missing user id claims")
  }
}

function assertOrganizationId(
  organizationId: string | undefined,
): asserts organizationId is string {
  if (!organizationId) {
    throw new Error("Missing organization id")
  }
}

export async function getUserAccessToken(
  config: LogtoNextConfig,
  resource: string,
): Promise<string> {
  return getAccessToken(config, resource)
}

export async function getSigninMethodRSC(
  config: LogtoNextConfig,
  resource?: string,
): Promise<string | undefined> {
  const tok = await getAccessTokenRSC(config, resource)

  const jwkEndpoint = new URL("/oidc/jwks", config.endpoint).toString()
  const oidcEndpoint = new URL("/oidc", config.endpoint).toString()

  const signinMethod = await decodeSigninMethodFromToken(tok, {
    jwkEndpoint,
    oidcEndpoint,
  })

  return signinMethod
}

export const createGetSigninMethodRSC = (
  configFactory: ConfigFactory,
  logger: Logger,
) => {
  return async (): Promise<string | undefined> => {
    try {
      const config = configFactory()
      const resource = config.resources?.[0]
      return await getSigninMethodRSC(config, resource)
    } catch (error) {
      const code = (error as { code?: string }).code

      if (code === "not_authenticated") {
        // User is not logged in yet; treat as "no signin method"
        return undefined
      }

      logger.error({ error }, "Cannot get the signin method")

      // For other errors, log and treat as "no signin method"
      return undefined
    }
  }
}

export function getUserSignInMethod(token: string): string | undefined {
  const decoded = decodeJwt(token)

  if (!decoded) return undefined

  const signInMethod =
    "signinMethod" in decoded ? decoded.signinMethod : decoded.signInMethod

  if (!signInMethod || typeof signInMethod !== "string") {
    return undefined
  }

  return signInMethod
}

export const createInvokeGetAccessTokenAPI = (configFactory: ConfigFactory) => {
  return async (): Promise<string> => {
    const cookieHeader = headers().get("cookie") as string
    const config = configFactory()

    const res = await fetch(new URL("/api/token", config.baseUrl), {
      headers: { cookie: cookieHeader },
    })

    if (!res.ok) {
      if (res.status === 403) {
        const body = await res.json().catch(() => null)
        if (
          body &&
          typeof body === "object" &&
          "error" in body &&
          body.error === "no_organization" &&
          "redirectUrl" in body &&
          typeof body.redirectUrl === "string"
        ) {
          throw new NoOrganizationError(body.redirectUrl)
        }
      }
      throw new GetTokenError("Failed to retrieve token", res.status)
    }

    const { token } = (await res.json()) as { token: string }
    return token as string
  }
}

type DecodeTokenConfig = {
  jwkEndpoint: string
  oidcEndpoint: string
}

async function decodeSigninMethodFromToken(
  token: string,
  config: DecodeTokenConfig,
): Promise<string | undefined> {
  const payload = await decodeToken(token, config)

  const signinMethod =
    (payload as { signinMethod?: string }).signinMethod ??
    (payload as { signInMethod?: string }).signInMethod

  if (!signinMethod) {
    return undefined
  }

  return signinMethod
}

async function decodeToken(
  token: string,
  config: DecodeTokenConfig,
): Promise<JWTPayload> {
  // Reference: https://docs.logto.io/docs/recipes/protect-your-api/node/
  const jwks = createRemoteJWKSet(new URL(config.jwkEndpoint))
  const { payload } = await jwtVerify(token, jwks, {
    issuer: config.oidcEndpoint,
  })

  return payload
}

export const createGetCachedUserToken = (
  _config: AppConfig,
  redisConnection: RedisConnection,
  logger: Logger,
  configFactory: ConfigFactory,
  tokenServiceName: string,
) => {
  const invokeGetAccessTokenAPI = createInvokeGetAccessTokenAPI(configFactory)

  return async (userId: string | undefined): Promise<string> => {
    assertUserId(userId)
    try {
      return await redisConnection.getToken({
        userId,
        serviceName: tokenServiceName,
        getTokenFn: async (_serviceName) => invokeGetAccessTokenAPI(),
        logger,
      })
    } catch (error) {
      if (GetTokenError.isGetTokenError(error)) {
        throw error
      }
      // Check if it's a RedisConnectionError with specific status codes
      if (
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error &&
        typeof (error as { statusCode?: number }).statusCode === "number" &&
        [400, 401, 403].includes((error as { statusCode: number }).statusCode)
      ) {
        throw new GetTokenError("Failed to retrieve token", 400)
      }
      throw error
    }
  }
}

export const createGetCachedOrganizationToken = (
  redisConnection: RedisConnection,
  logger: Logger,
  configFactory: ConfigFactory,
  tokenServiceName: string,
) => {
  return async (
    userId: string | undefined,
    organizationId: string | undefined,
  ): Promise<string> => {
    assertUserId(userId)
    assertOrganizationId(organizationId)

    try {
      return await redisConnection.getToken({
        userId,
        organizationId,
        serviceName: tokenServiceName,
        getTokenFn: async (_serviceName) =>
          getOrganizationToken(configFactory(), organizationId),
        logger,
      })
    } catch (error) {
      return normalizeRedisTokenError(error)
    }
  }
}

export const createInvalidateCachedUserToken = (
  redisConnection: RedisConnection,
  tokenServiceName: string,
) => {
  return async (userId: string): Promise<void> => {
    await redisConnection.deleteToken({
      userId,
      serviceName: tokenServiceName,
    })
  }
}
