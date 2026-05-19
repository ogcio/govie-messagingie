import { expect, type Page, test } from "@playwright/test"
import { createAuthenticatedPage } from "../helpers/user-auth.helper"
import { navigateAndVerifySearch } from "../utils/navigation-helpers"

let page: Page

test.describe("User Messages page", () => {
  test.beforeAll(async ({ browser }) => {
    page = await createAuthenticatedPage(browser, "peter.parker@mail.ie")
    // Remove the modal element if it appears
    await page.addLocatorHandler(
      page.locator("body > div.gi-modal.gi-modal-open"),
      async (modalLocator) => {
        await modalLocator.evaluateAll((elements) =>
          elements.forEach((el) => {
            el.remove()
          }),
        )
      },
    )
  })

  test.afterAll(async () => {
    await page.close()
  })

  test("a user can open a message @smoke @regression", async () => {
    await navigateAndVerifySearch(page, "/en/messages", "Search")
    await page.getByRole("textbox", { name: "Search" }).fill("test")
    await page.getByRole("textbox", { name: "Search" }).press("Enter")
    await page.waitForLoadState("networkidle")
    await page
      .locator(
        "body > main > div > div > div > div > div > div > section > div.unified-inbox-table-module__iNj3tG__desktopTable > table > tbody > tr:nth-child(1)",
      )
      .click()
    await expect(
      page.getByRole("heading", { name: "Test Subject" }),
    ).toBeVisible()
    await expect(
      page
        .locator('iframe[title="Secure email content viewer"]')
        .contentFrame()
        .getByText("Test rich text"),
    ).toBeVisible()
  })

  test("a user can open a message attachment @smoke @regression", async () => {
    await page.goto("/en/secure-messages/becb3e86-6a5c-48e1-8bf7-c1cb884df69c")
    //this next page is now in a new tab so we need to get the new page
    const [newPage] = await Promise.all([
      page.context().waitForEvent("page"),
      page.getByRole("button", { name: "test123.txt" }).click(),
      //page.getByTestId("attachment-download-action").click(),
    ])
    await newPage.waitForLoadState("domcontentloaded")
    await expect(newPage.getByText("46546546546546")).toBeVisible()
  })

  test("a user can access a recent message from the dashboard @regression", async () => {
    await page.waitForLoadState("networkidle")

    await page.goto("https://dashboard.dev.services.gov.ie/en/my-dashboard")
    await page.waitForLoadState("networkidle")
    await expect(
      page.getByRole("heading", { name: "Welcome back, Toby Tobyson" }),
    ).toBeVisible()
    //wait for no new messages to be removed
    await page.waitForSelector("text=No new messages", { state: "detached" })
    await page
      .locator(
        "body > main > div > div > div > article > div:nth-child(1) > div > div > div:nth-child(1) > a",
      )
      .click()
    await expect(page.url()).toContain("messaging.dev.services.gov.ie/")
    await expect(page.getByRole("link", { name: "Back" })).toBeVisible()
  })
})
