import { expect, type Page, test } from "@playwright/test"
import { authenticateUser } from "../helpers/auth"
import { createPageWithVideo } from "../helpers/browser-context"
import { loginAsCitizen } from "../helpers/user-auth.helper"
import { logout, sendMessageToDevCitizen } from "../utils/functions"
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
    await authenticatedPage.waitForLoadState("networkidle")
    await loginAsCitizen(authenticatedPage, "peter.parker@mail.ie")
    //open first unread message
    // First data row (nth(0) is the header). The desktop table's CSS-module
    // class is hashed at build time, so target by ARIA role instead.
    await authenticatedPage.getByRole("row").nth(1).click()

    await authenticatedPage.waitForLoadState("networkidle")
    await expect(
      authenticatedPage
        .locator('iframe[title="Secure email content viewer"]')
        .contentFrame()
        .getByText("Test rich text"),
    ).toBeVisible()
  })

  test("admin sends message to citizen and they delete email @smoke @regression", async () => {
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
    await authenticatedPage.waitForLoadState("networkidle")
    await loginAsCitizen(authenticatedPage, "peter.parker@mail.ie")
    //open first unread message
    // First data row (nth(0) is the header). The desktop table's CSS-module
    // class is hashed at build time, so target by ARIA role instead.
    await authenticatedPage.getByRole("row").nth(1).click()

    await authenticatedPage.waitForLoadState("networkidle")
    await authenticatedPage.getByRole("button", { name: "Delete" }).click()
    await authenticatedPage.getByRole("button", { name: "Delete" }).click()
    await expect(
      authenticatedPage.getByRole("alert", {
        name: "1 message has been deleted",
      }),
    ).toBeVisible()
  })

  test("citizen can see a secure message in their emails @smoke @regression", async () => {
    await authenticateUser(authenticatedPage)
    await sendMessageToDevCitizen(authenticatedPage)
    //logout as admin
    await logout(authenticatedPage)
    await authenticatedPage.waitForLoadState("networkidle")
    // Wait for the messages table to load
    await loginAsCitizen(authenticatedPage, "peter.parker@mail.ie")
    await authenticatedPage.waitForLoadState("networkidle")
    await previewRecentMessageEmail(authenticatedPage, "me")
    await authenticatedPage.waitForLoadState("networkidle")

    await expect(
      authenticatedPage
        .locator("body > main > div > div > div > div > h1")
        .first(),
    ).toHaveText("Test Subject")
  })
})
