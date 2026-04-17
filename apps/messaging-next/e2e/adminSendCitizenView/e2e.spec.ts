import { expect, type Page, test } from "@playwright/test"
import { authenticateUser } from "../helpers/auth"
import { createPageWithVideo } from "../helpers/browser-context"
import { loginAsCitizen } from "../helpers/user-auth.helper"
import { giveConsent } from "../utils/consent-helper"
import {
  clickButton,
  logout,
  sendMessageToDevCitizen,
  sendMessageToNewEmailAddress,
} from "../utils/functions"
import { previewRecentMessageEmail } from "../utils/gmail-reader"

let authenticatedPage: Page

test.describe("Admin Message Sending > Citizen Viewing", () => {
  test.beforeEach(async ({ browser }) => {
    authenticatedPage = await createPageWithVideo(browser)
    //clear the cache
    await authenticatedPage.context().clearCookies()
  })

  test.afterAll(async () => {
    await authenticatedPage.close()
  })

  test("admin sends message to citizen and they receive email @smoke @regression", async () => {
    await authenticateUser(authenticatedPage)
    await sendMessageToDevCitizen(authenticatedPage)
    await authenticatedPage
      .getByRole("link", { name: "View Event log" })
      .click()
    await authenticatedPage.getByRole("link", { name: "View" }).first().click()

    // Verify message content details
    // Verify the current date is displayed
    const currentDate = new Date()
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
      .replace(/\//g, "-")
    await expect(
      authenticatedPage.getByRole("cell", { name: currentDate }).first(),
    ).toBeVisible()

    // Verify the time is recent (matches HH:MM:SS format and is within reasonable range)
    const timePattern = /\d{2}:\d{2}:\d{2}/
    const timeCells = authenticatedPage
      .getByRole("cell")
      .filter({ hasText: timePattern })
    await expect(timeCells.first()).toBeVisible()

    await expect(authenticatedPage.getByText("failed")).not.toBeVisible()
    //logout as admin
    await logout(authenticatedPage)
    await loginAsCitizen(authenticatedPage, "peter.parker@mail.ie")
    //open first unread message
    await authenticatedPage
      .locator("#table-body > tr:nth-child(1) > td:nth-child(2) > div > a")
      .first()
      .click()
    await authenticatedPage.waitForLoadState("networkidle")
    await expect(
      authenticatedPage
        .locator('iframe[title="Secure email content viewer"]')
        .contentFrame()
        .getByText("Test rich text"),
    ).toBeVisible()
  })

  test("citizen can see a secure message in their emails @smoke @regression", async () => {
    await authenticateUser(authenticatedPage)
    await sendMessageToDevCitizen(authenticatedPage)
    //logout as admin
    await logout(authenticatedPage)
    await previewRecentMessageEmail(authenticatedPage, "me")
    // Wait for the messages table to load
    await loginAsCitizen(authenticatedPage, "peter.parker@mail.ie")
    await authenticatedPage.waitForLoadState("networkidle")
    await expect(
      authenticatedPage
        .locator("#table-body > tr:nth-child(1) > td:nth-child(2) > div > a")
        .first(),
    ).toHaveText("Test Subject")
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
    await authenticatedPage
      .getByRole("button", { name: "MyGovId (MyGovId connector)" })
      .click()
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
    await authenticatedPage
      .getByRole("button", { name: "MyGovId (MyGovId connector)" })
      .click()
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
