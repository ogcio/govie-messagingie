import { expect, type Page, test } from "@playwright/test"
import { authenticateUser } from "../helpers/auth"
import { createPageWithVideo } from "../helpers/browser-context"
import { giveConsent } from "../utils/consent-helper"
import {
  clickButton,
  logout,
  sendMessageToNewEmailAddress,
} from "../utils/functions"
import { previewRecentMessageEmail } from "../utils/gmail-reader"

let authenticatedPage: Page

test.describe("Uset can link a new email address to an account", () => {
  test.beforeEach(async ({ browser }) => {
    authenticatedPage = await createPageWithVideo(browser)
    //clear the cache
    await authenticatedPage.context().clearCookies()
  })

  test.afterAll(async () => {
    await authenticatedPage.close()
  })

  test("citizen can link a new email address to an account @smoke @regression", async () => {
    await authenticateUser(authenticatedPage)
    const email = await sendMessageToNewEmailAddress(authenticatedPage)
    //logout as admin
    await logout(authenticatedPage)
    // Click link from email
    await previewRecentMessageEmail(authenticatedPage, email)
    // Login as a new user
    //await authenticatedPage.goto("/")
    if (
      authenticatedPage
        .url()
        .includes("https://authorization.dev.services.gov.ie/sign-in")
    ) {
      // Click the MyGovID login button
      await authenticatedPage
        .getByRole("button", { name: "Continue with MyGovId" })
        .click()
    }
    await authenticatedPage.getByRole("button", { name: "LOGIN" }).click()
    await authenticatedPage.waitForLoadState("networkidle")
    //Confirm consent
    await giveConsent(authenticatedPage)
    // Confirm link account
    await clickButton(authenticatedPage, "Confirm")
    await expect(
      authenticatedPage.getByRole("heading", { name: "Test Subject" }),
    ).toBeVisible()
  })

  test("citizen can report receiving an email to an address not linked to their account @smoke @regression", async () => {
    await authenticateUser(authenticatedPage)
    const email = await sendMessageToNewEmailAddress(authenticatedPage)
    //logout as admin
    await logout(authenticatedPage)
    await previewRecentMessageEmail(authenticatedPage, email)
    // Login as a new user
    //await authenticatedPage.goto("/")
    if (
      authenticatedPage
        .url()
        .includes("https://authorization.dev.services.gov.ie/sign-in")
    ) {
      // Click the MyGovID login button
      await authenticatedPage
        .getByRole("button", { name: "Continue with MyGovId" })
        .click()
    }
    await authenticatedPage.getByRole("button", { name: "LOGIN" }).click()
    await authenticatedPage.waitForLoadState("networkidle")
    //Confirm consent
    await giveConsent(authenticatedPage)
    // Confirm link account
    await clickButton(authenticatedPage, "Report an Issue")
    //Disabled as forms url is not configured in dev
    //await authenticatedPage.waitForLoadState("networkidle")
    //const url = await authenticatedPage.url()
    //await expect(url).toContain("forms")
  })
})
