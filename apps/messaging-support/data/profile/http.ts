import { getEnvConfig } from "@/utils/env"
import type { LogtoUser, LogtoUserRole, Result } from "../types"
import {
  failure,
  fetchUsersConcurrent,
  GENERIC_USER_ERROR,
  success,
} from "../utils"

export async function fetchPatchLinkedAccount(params: {
  bearerToken: string
  profileId: string
  primaryUserId: string | null
}): Promise<Result<void>> {
  const { bearerToken, primaryUserId, profileId } = params
  try {
    const { PROFILE_API_RESOURCE_URL } = getEnvConfig()

    const apiUrl = new URL(
      `api/v1/organisations/profiles/${profileId}`,
      PROFILE_API_RESOURCE_URL,
    )
    const profilePatchResponse = await fetch(apiUrl, {
      method: "PATCH",
      body: JSON.stringify({ primaryUserId }),
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        "Content-Type": "application/json",
      },
    })

    const data = await profilePatchResponse.json()

    if (!profilePatchResponse.ok) {
      throw new Error(`error patching profile: ${JSON.stringify(data)}`)
    }

    return success(undefined)
  } catch (err) {
    return failure(err, GENERIC_USER_ERROR)
  }
}

export async function fetchM2MmanagementAccessToken(): Promise<Result<string>> {
  const {
    M2M_MANAGEMENT_ID,
    M2M_MANAGEMENT_SECRET,
    MANAGEMENT_API,
    LOGTO_URL,
  } = getEnvConfig()
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: M2M_MANAGEMENT_ID,
    client_secret: M2M_MANAGEMENT_SECRET,
    resource: MANAGEMENT_API,
    scope: "all",
  })

  try {
    const tokenUrl = new URL("/oidc/token", LOGTO_URL)
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    })

    if (!response.ok) {
      const errText = await response.text()
      return failure(
        new Error(`failed to get Logto token: ${response.status} - ${errText}`),
        GENERIC_USER_ERROR,
      )
    }

    const data = await response.json()
    const token = data.access_token as string
    return success(token)
  } catch (err) {
    return failure(err, GENERIC_USER_ERROR)
  }
}

export async function fetchLogtoUsers(
  profileIds: string[],
  m2mManagementApiToken: string,
): Promise<Result<LogtoUser[]>> {
  const params = new URLSearchParams([
    ...profileIds.map((id) => ["search.id", id]),
    ["mode.id", "exact"],
    ["joint", "or"],
  ])

  try {
    const { LOGTO_URL } = getEnvConfig()
    const res = await fetch(`${LOGTO_URL}/api/users?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${m2mManagementApiToken} `,
        "Content-Type": "application/json",
      },
    })

    if (!res.ok) {
      const errorText = await res.text()
      return failure(
        new Error(`failed to get logto users: ${res.status} - ${errorText}`),
        GENERIC_USER_ERROR,
      )
    }

    const json = await res.json()
    return success(json as LogtoUser[])
  } catch (err) {
    return failure(err, GENERIC_USER_ERROR)
  }
}

export async function fetchLogtoUserRole(
  profileIds: string[],
  m2mManagementApiToken: string,
): Promise<Result<LogtoUserRole[][]>> {
  try {
    const roles = await fetchUsersConcurrent<LogtoUserRole[]>(
      profileIds,
      async function fetchUserRole(profileId) {
        const { LOGTO_URL } = getEnvConfig()
        const res = await fetch(`${LOGTO_URL}/api/users/${profileId}/roles`, {
          headers: {
            Authorization: `Bearer ${m2mManagementApiToken}`,
            "Content-Type": "application/json",
          },
        })

        if (!res.ok) {
          return []
        }
        return res.json()
      },
      10,
    )

    return success(roles)
  } catch (err) {
    return failure(err, GENERIC_USER_ERROR)
  }
}

export async function fetchDeleteAccount(params: {
  bearerToken: string
  profileId: string
  requesterUserId: string
}): Promise<Result<void>> {
  const { bearerToken, profileId, requesterUserId } = params
  try {
    const { PROFILE_API_RESOURCE_URL } = getEnvConfig()

    const apiUrl = new URL(`/api/v1/lifecycle-tasks`, PROFILE_API_RESOURCE_URL)
    const profilePatchResponse = await fetch(apiUrl, {
      method: "POST",
      body: JSON.stringify({
        type: "delete_profile",
        profileId,
        requesterUserId,
      }),
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        "Content-Type": "application/json",
      },
    })

    const data = await profilePatchResponse.json()

    if (!profilePatchResponse.ok) {
      throw new Error(`error deleting profile: ${JSON.stringify(data)}`)
    }

    return success(undefined)
  } catch (err) {
    return failure(err, GENERIC_USER_ERROR)
  }
}
