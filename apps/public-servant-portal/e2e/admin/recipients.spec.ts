import { expect, test } from "@playwright/test"
import { contacts, urls } from "../fixtures"
import { clickButton } from "../utils/functions"
import { navigateAndVerifyHeading } from "../utils/navigation-helpers"
import { setupTestSuite } from "../utils/test-helpers"

const ADMIN_URL = urls.admin

setupTestSuite("Admin Recipients Management", (getAuthenticatedPage) => {
  test("an admin can search for recipients @regression", async () => {
    const authenticatedPage = getAuthenticatedPage()
    await navigateAndVerifyHeading(
      authenticatedPage,
      `${ADMIN_URL}/en/send-a-message`,
      "Send a message",
    )
    await clickButton(authenticatedPage, "Continue to recipients")

    await authenticatedPage
      .getByRole("tabpanel", { name: "Search" })
      .locator('input[name="email"]')
      .fill("messagingie2@gmail.com")

    await authenticatedPage
      .getByRole("button", { name: "Search" })
      .evaluate((button: HTMLButtonElement) => button.click())
    await expect(
      authenticatedPage.getByRole("row", {
        name: "messaging ie2 <messagingie2@gmail.com>",
      }),
    ).toBeVisible()
  })

  test("Admin can remove a recipient from a message before it is scheduled @regression", async () => {
    const authenticatedPage = getAuthenticatedPage()
    await navigateAndVerifyHeading(
      authenticatedPage,
      `${ADMIN_URL}/en/send-a-message`,
      "Send a message",
    )
    await clickButton(authenticatedPage, "Continue to recipients")

    // Verify empty list and add recipient
    await expect(
      authenticatedPage.getByRole("cell", { name: "List is empty" }).last(),
    ).toBeVisible()
    await authenticatedPage
      .getByRole("table", { name: "Recipients in database" })
      .getByRole("button", { name: "Add recipient" })
      .first()
      .click()

    // Verify recipient added and then remove
    await expect(
      authenticatedPage.getByRole("cell", { name: "List is empty" }).last(),
    ).not.toBeVisible()
    await clickButton(authenticatedPage, "Remove Recipient")
    await expect(
      authenticatedPage.getByRole("cell", { name: "List is empty" }),
    ).toBeVisible()
  })

  test("Admin cannot add an opted-out recipient @regression", async () => {
    const authenticatedPage = getAuthenticatedPage()
    await navigateAndVerifyHeading(
      authenticatedPage,
      `${ADMIN_URL}/en/send-a-message`,
      "Send a message",
    )
    await clickButton(authenticatedPage, "Continue to recipients")

    // Search for recipient and add
    await expect(
      authenticatedPage.getByRole("cell", { name: "List is empty" }).last(),
    ).toBeVisible()

    await authenticatedPage
      .getByRole("tabpanel", { name: "Search" })
      .locator('input[name="email"]')
      .fill(contacts.recipient.email)
    await authenticatedPage
      .getByRole("button", { name: "Search" })
      .evaluate((button: HTMLButtonElement) => button.click())
    await expect(
      authenticatedPage
        .getByLabel("Search")
        .getByRole("cell", { name: "List is empty" }),
    ).toBeHidden()

    await expect(
      authenticatedPage.getByRole("cell", { name: "Alejandro Gonzales" }),
    ).toBeVisible()
    await expect(
      authenticatedPage
        .getByRole("row", {
          name: "Alejandro Gonzales <alejandro.gonzales@mail.ie>",
        })
        .getByRole("button", { name: "Add recipient" }),
    ).toBeDisabled()

    // Verify recipient has not been added
    await expect(
      authenticatedPage.getByRole("cell", { name: "List is empty" }),
    ).toBeVisible()
  })
})
