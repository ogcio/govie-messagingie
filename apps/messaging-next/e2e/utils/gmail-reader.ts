import { expect, type Page } from "@playwright/test"
import { checkInbox, getAccessToken, parseHtmlFromEmail } from "gmail-getter"

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
  })
  await expect(email).not.toBeNull()
  const html = await parseHtmlFromEmail(email)
  await page.setContent(html)
  await page.getByText("https://messaging.services.gov.ie").first().click()
}
