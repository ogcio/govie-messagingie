import { expect, type Page, test } from "@playwright/test"
import { createAuthenticatedPage } from "../helpers/user-auth.helper"
import { navigateAndVerifySearch } from "../utils/navigation-helpers"

const BASE_URL = process.env.BASE_URL || "http://localhost:3001"
const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3004"

let page: Page

test.describe("User Messages page", () => {
  test.beforeAll(async ({ browser }) => {
    page = await createAuthenticatedPage(browser, "peter.parker@mail.ie")})

  test.afterAll(async () => {
    await page.close()
  })

  test("a user can open a message @smoke @regression", async () => {
    await navigateAndVerifySearch(page, "/en/messages", "Search")
    await page.getByRole("textbox", { name: "Search" }).fill("test")
    await page.getByRole("textbox", { name: "Search" }).press("Enter")
    await page.waitForLoadState("networkidle")
    // First data row (nth(0) is the header). The desktop table's CSS-module
    // class is hashed at build time, so target by ARIA role instead.
    await page.getByRole("row").nth(1).click()
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
      page.getByTestId("attachment-preview-action").click(),
      //page.getByTestId("attachment-download-action").click(),
    ])
    await newPage.waitForLoadState("domcontentloaded")
    await expect(newPage.getByText("46546546546546")).toBeVisible()
  })

  test("a user can download a message attachment @smoke @regression", async () => {
    await page.goto("/en/secure-messages/becb3e86-6a5c-48e1-8bf7-c1cb884df69c")

    const downloadPromise = page.waitForEvent("download")
    page.getByTestId("attachment-download-action").click()
    const download = await downloadPromise

    await download.saveAs(`downloads/${download.suggestedFilename()}`)

    const path = await download.path()
    expect(path).not.toBeNull()
  })

  test("a user can access a recent message from the dashboard @regression", async () => {
    //await page.waitForLoadState("networkidle")

    await page.goto(`${DASHBOARD_URL}/en/my-dashboard`)
    await page.waitForLoadState("networkidle")
    await expect(
      page.getByRole("heading", { name: "Welcome back, Toby Tobyson" }),
    ).toBeVisible()
    //wait for no new messages to be removed
    await page.waitForSelector("text=No new messages", { state: "detached" })
    await page.getByText("View all messages").click()
    await expect(page.url()).toContain(`${BASE_URL}`)
  })
})
