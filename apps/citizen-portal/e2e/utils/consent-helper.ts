import type { Page } from "@playwright/test"

export async function giveConsent(page: Page, declineConsent = false) {
  const buttonName = declineConsent ? "Decline" : "Accept"
  await page
    .locator(
      "body > div.gi-modal.gi-modal-open > div > div.gi-pb-6 > div.gi-modal-body",
    )
    .hover()
  await page.mouse.wheel(0, 2000)
  await page.getByRole("button", { name: buttonName }).click()
}
