import { logger } from "./logger"
import type { Failure, Success } from "./types"

type FetchUserFn<T> = (profileId: string) => Promise<T>

export async function fetchUsersConcurrent<T>(
  profileIds: string[],
  fetchUser: FetchUserFn<T>,
  concurrency: number = 20,
): Promise<T[]> {
  const results: T[] = []
  let index = 0

  async function worker() {
    while (index < profileIds.length) {
      const current = index++

      try {
        results[current] = await fetchUser(profileIds[current])
      } catch (err) {
        logger.error(
          {
            profileId: profileIds[current],
            error: serializeErrorForLog(err),
          },
          `Failed to fetch user`,
        )
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  return results
}

export function success<T>(value: T): Success<T> {
  return { success: true, value }
}

export function failure(error: unknown, userMessage: string): Failure {
  logger.error(
    { error: serializeErrorForLog(error) },
    `Failure: ${userMessage}`,
  )
  return {
    success: false,
    error: isError(error) ? error : new Error(userMessage),
    userMessage,
  }
}

export function isError(error: unknown): error is Error {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    error instanceof Error
  )
}

/**
 * Log-safe view of an unknown error value. Mirrors the helper in
 * `@ogcio/authorisation` — explicit field whitelist, no stack, no recursion,
 * to avoid leaking sensitive context via Pino bindings (CWE-532).
 */
export type SerializedErrorForLog = {
  name: string
  message: string
  code?: string
  statusCode?: number
  cause?: { name: string; message: string }
}

export function serializeErrorForLog(error: unknown): SerializedErrorForLog {
  if (error instanceof Error) {
    const out: SerializedErrorForLog = {
      name: error.name,
      message: error.message,
    }

    const code = (error as { code?: unknown }).code
    if (typeof code === "string") {
      out.code = code
    }

    const statusCode = (error as { statusCode?: unknown }).statusCode
    if (typeof statusCode === "number" && Number.isFinite(statusCode)) {
      out.statusCode = statusCode
    } else {
      const status = (error as { status?: unknown }).status
      if (typeof status === "number" && Number.isFinite(status)) {
        out.statusCode = status
      }
    }

    const cause = (error as { cause?: unknown }).cause
    if (cause instanceof Error) {
      out.cause = { name: cause.name, message: cause.message }
    }

    return out
  }

  if (typeof error === "string") {
    return { name: "UnknownError", message: error }
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return {
      name: "UnknownError",
      message: (error as { message: string }).message,
    }
  }

  return { name: "UnknownError", message: String(error) }
}

export const GENERIC_USER_ERROR =
  "We encountered a temporary issue accessing system data. Please refresh the page."
export const PROFILE_NOT_FOUND_FOR_EMAIL = "No account found with this email."
export const PROFILE_NOT_FOUND_FOR_ID = "No account found with this ID."
