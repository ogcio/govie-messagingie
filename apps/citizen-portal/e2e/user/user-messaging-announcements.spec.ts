import { expect, type Page, test } from "@playwright/test"
import { contacts } from "../fixtures"
import { createPageWithVideo } from "../helpers/browser-context"
import { waitForMockLoginForm } from "../helpers/user-auth.helper"

let page: Page

test.describe("User Messages page", () => {
  test.beforeAll(async ({ browser }) => {
    page = await createPageWithVideo(browser)
    await page.goto("/")
    await waitForMockLoginForm(page)
    await page
      .locator(
        "#login-form > div > div.gi-w-full > div:nth-child(2) > div.gi-accordion > div",
      )
      .click()
    await page.locator("#firstName").fill("Catherine")
    await page.locator("#lastName").fill("Sigurjónsdóttir")
    await page
      .locator("#email")
      .fill(contacts.announcementRecipient.email)
    await page.getByRole("button", { name: "LOGIN" }).click()
    await expect(page).toHaveURL(/.*\/en\//)
  })

  test.afterAll(async () => {
    await page.context().clearCookies() // Clear cookies to reset state for other tests
    await page.close()
  })

  // Announcements are global per application, not recipient-specific. Dev's
  // messaging feed is empty; re-enable when the pipeline seeds one.
  test.fixme("a user can see an announcement @regression", async () => {
    await expect(
      page.getByRole("heading", { name: "Your inbox has been updated" }),
    ).toBeVisible()
  })
})
