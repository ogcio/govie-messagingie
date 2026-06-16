import { env } from "@/env/env.client"

/**
 * Checks if an error is a connection error (e.g., ECONNREFUSED during build time)
 * @param error - The error to check
 * @returns true if the error is a connection error, false otherwise
 */
export function isConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const errorMessage = error.message.toLowerCase()
  const hasConnectionError =
    errorMessage.includes("econnrefused") ||
    errorMessage.includes("fetch failed")

  const hasConnectionErrorInCause =
    error.cause instanceof Error &&
    error.cause.message.toLowerCase().includes("econnrefused")

  return hasConnectionError || hasConnectionErrorInCause
}

/**
 * Gets the base URL for API requests
 * Uses NEXT_PUBLIC_BASE_URL if set, otherwise falls back to localhost for development
 * @returns The base URL string
 */
export function getBaseUrl(): string {
  return env.NEXT_PUBLIC_BASE_URL
}
