import type { Page } from "@playwright/test"

export async function giveConsent(page: Page, declineConsent = false) {
  const buttonName = declineConsent ? "Decline" : "Accept"
  await page.getByRole("dialog").hover()
  await page.mouse.wheel(0, 2000)
  await page.getByRole("button", { name: buttonName }).click()
}
