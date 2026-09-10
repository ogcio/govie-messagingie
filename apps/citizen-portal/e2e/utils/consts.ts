import { urls } from "../fixtures"

export const PROFILE_URL = urls.profileAdmin
export const SERVICE_USERS_URL = `${PROFILE_URL}/service-users`
export const WAIT_TIME = 2000

/** Logto sign-in page — matches `e2e/helpers/user-auth.helper.ts`. */
export const AUTH_SIGN_IN_URL = urls.authSignIn

/**
 * Citizen-facing profile hostname. Local full e2e sets `PROFILE_HOST`;
 * hosted dev e2e falls back to the real cluster URL.
 */
export const PROFILE_SERVICE_URL = urls.profileService

/** Mirrors Journey Builder / Payments logout redirect shape. */
export function buildGlobalSignoutUrl(
  postRedirectUri: string,
  role: "citizen" | "public-servant" = "citizen",
) {
  const url = new URL("/global-signout", PROFILE_SERVICE_URL)
  url.searchParams.set("postRedirectUri", postRedirectUri)
  url.searchParams.set("role", role)
  return url.toString()
}

export const TEST_DATA = {
  providerHost: "Test provider host",
  providerTestValue: "Test provider value", //this value is for the provider password field//
  templateSubject: "Test subject",
  templateRichText: "Test rich text",
  templatePlainText: "Test plain text",
}
