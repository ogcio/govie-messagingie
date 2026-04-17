import { expect, type Page } from "@playwright/test"
import { checkInbox, getAccessToken, parseHtmlFromEmail } from "gmail-getter"

export async function previewRecentMessageEmail(
  page: Page,
  recipientEmail: string,
) {
  const accessToken = await getAccessToken(
    "540788839261-92q2702kc86ulc21i6hutbp0c7p329uk.apps.googleusercontent.com",
    "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",
    "1//09EtIF4a-rkFcCgYIARAAGAkSNwF-L9Irh9usRBoC8WGFpNxV-TS_9ZDk-rPnibbIk8oWAk0-EK9IZVoL325qcyBf6SmoRS9DPeE",
    // Refresh token needs to be updated every 30 days
    // Add credentials.json from bitlocker to messaging app folder
    // Run 'npx gmail-getter get-refresh-token' from messaging folder,
    // Login to the messagingie2@gmail.com gmail account and approve the account link in a webbrowser window that opens
    // Update the above value
  )

  const email = await checkInbox({
    token: accessToken,
    query: `to:${recipientEmail} AND subject:secure message`,
  })
  await expect(email).not.toBeNull()
  const html = await parseHtmlFromEmail(email)
  await page.setContent(html)
  await page.getByText("https://messaging.services.gov.ie").first().click()
}
