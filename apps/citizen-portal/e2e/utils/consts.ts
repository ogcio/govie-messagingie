export const PROFILE_URL = "https://profile-admin.dev.services.gov.ie/en"
export const SERVICE_USERS_URL = `${PROFILE_URL}/service-users`
export const WAIT_TIME = 2000

/** Logto sign-in page — matches `e2e/helpers/user-auth.helper.ts`. */
export const AUTH_SIGN_IN_URL =
  process.env.E2E_AUTH_URL?.trim() ||
  process.env.AUTH_URL?.trim() ||
  "https://authorization.dev.services.gov.ie/sign-in"

/**
 * Citizen-facing profile hostname. Local full e2e sets `PROFILE_HOST`;
 * hosted dev e2e falls back to the real cluster URL.
 */
export const PROFILE_SERVICE_URL =
  process.env.PROFILE_HOST ?? "https://profile.dev.services.gov.ie"

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
