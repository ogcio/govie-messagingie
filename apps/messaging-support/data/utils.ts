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
          { profileId: profileIds[current], error: err },
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
  logger.error({ error }, `Failure: ${userMessage}`)
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

export const GENERIC_USER_ERROR =
  "We encountered a temporary issue accessing system data. Please refresh the page."
export const PROFILE_NOT_FOUND_FOR_EMAIL = "No account found with this email."
export const PROFILE_NOT_FOUND_FOR_ID = "No account found with this ID."
