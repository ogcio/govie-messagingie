import { expect, type Page, test } from "@playwright/test"
import { createPageWithVideo } from "../helpers/browser-context"

let page: Page

test.describe("User Messages page", () => {
  test.beforeAll(async ({ browser }) => {
    page = await createPageWithVideo(browser)
    await page.goto("/")
    if (
      page.url().includes("https://authorization.dev.services.gov.ie/sign-in")
    ) {
      // Click the MyGovID login button

      await page.getByRole("button", { name: "Continue with MyGovId" }).click()
    }
    await page
      .locator(
        "#login-form > div > div.gi-w-full > div:nth-child(2) > div.gi-accordion > div",
      )
      .click()
    await page.locator("#firstName").fill("Catherine")
    await page.locator("#lastName").fill("Sigurjónsdóttir")
    await page.locator("#email").fill("catherine.sigurjonsdottir@mail.ie")
    await page.getByRole("button", { name: "LOGIN" }).click()
    await page.waitForLoadState("networkidle")
  })

  test.afterAll(async () => {
    await page.context().clearCookies() // Clear cookies to reset state for other tests
    await page.close()
  })

  test("a user can see an announcement @regression", async () => {
    await expect(page.locator("body > div:nth-child(27) > div")).toBeVisible()
  })
})
