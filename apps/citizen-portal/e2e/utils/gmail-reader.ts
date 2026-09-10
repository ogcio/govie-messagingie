import { expect, type Page } from "@playwright/test"
import { checkInbox, getAccessToken, parseHtmlFromEmail } from "gmail-getter"

export function gmailCredentialsAvailable() {
  return Boolean(
    process.env.E2E_GMAIL_CLIENT_ID &&
      process.env.E2E_GMAIL_CLIENT_SECRET &&
      process.env.E2E_GMAIL_REFRESH_TOKEN,
  )
}

export async function previewRecentMessageEmail(
  page: Page,
  recipientEmail: string,
) {
  const clientId = process.env.E2E_GMAIL_CLIENT_ID
  const clientSecret = process.env.E2E_GMAIL_CLIENT_SECRET
  const refreshToken = process.env.E2E_GMAIL_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "E2E Gmail credentials are missing; set E2E_GMAIL_CLIENT_ID, E2E_GMAIL_CLIENT_SECRET and E2E_GMAIL_REFRESH_TOKEN.",
    )
  }

  const accessToken = await getAccessToken(clientId, clientSecret, refreshToken)

  const email = await checkInbox({
    token: accessToken,
    query: `to:${recipientEmail} AND subject:secure message`,
    timeout: 60_000,
  })
  await expect(email).not.toBeNull()
  const html = await parseHtmlFromEmail(email)
  // Admin logout clears cookies then probes a protected route, which starts a
  // fresh OIDC interaction. Drop those cookies before following the email
  // link so the deep-link cannot ride a live SSO session past the mock IdP —
  // link-account / receive-messages both need the form for a new identity.
  await page.context().clearCookies()
  await page.setContent(html)
  await page.getByText("https://messaging.services.gov.ie").first().click()
}
