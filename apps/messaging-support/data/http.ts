import { getEnvConfig } from "@/utils/env"
import cache from "./cache/memory"
import type { KVCache } from "./cache/types"
import type { Result } from "./types"
import { failure, GENERIC_USER_ERROR, success } from "./utils"

const cacheAppM2MTokenKey = "m2m-key"
const tokenExpiryBuffer = 300

type Token = { access_token: string; expires_in: number }
function isValidToken(v: unknown): v is Token {
  const token = v as Token
  return (
    typeof token?.access_token === "string" &&
    typeof token?.expires_in === "number"
  )
}

async function fetchAppM2MToken(): Promise<
  Result<{ access_token: string; expires_in: number }>
> {
  try {
    const {
      LOGTO_URL,
      LOGTO_M2M_CLIENT_ID,
      LOGTO_M2M_CLIENT_SECRET,
      LOGTO_PLATFORM_ADMIN_RESOURCE,
    } = getEnvConfig()

    const response = await fetch(`${LOGTO_URL}/oidc/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: LOGTO_M2M_CLIENT_ID,
        client_secret: LOGTO_M2M_CLIENT_SECRET,
        scope: ["platform:profile:write", "platform:profile:read"].join(" "),
        resource: LOGTO_PLATFORM_ADMIN_RESOURCE,
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(`error getting token: ${JSON.stringify(data)}`)
    }

    if (!isValidToken(data)) {
      throw new Error(`invalid token data ${JSON.stringify(data)}`)
    }
    return success(data)
  } catch (err) {
    return failure(err, GENERIC_USER_ERROR)
  }
}

async function fetchCachedAppM2MToken(cache: KVCache): Promise<Result<string>> {
  const cachedEntry = await cache.get<Token>(cacheAppM2MTokenKey, isValidToken)
  if (cachedEntry) {
    return success(cachedEntry.access_token)
  }

  const requestTokenResult = await fetchAppM2MToken()
  if (!requestTokenResult.success) {
    return requestTokenResult
  }
  cache.set(
    cacheAppM2MTokenKey,
    requestTokenResult.value,
    requestTokenResult.value.expires_in - tokenExpiryBuffer,
  )

  return success(requestTokenResult.value.access_token)
}

export const AppHttp = {
  fetchAppM2MToken: () => fetchCachedAppM2MToken(cache),
} as const
