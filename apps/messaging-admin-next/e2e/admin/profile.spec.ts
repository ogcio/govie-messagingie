import { expect, type Page, test } from "@playwright/test"
import { authenticateUser } from "../helpers/auth"
import { createPageWithVideo } from "../helpers/browser-context"
import { logout } from "../utils/functions"

let authenticatedPage: Page

const ADMIN_URL = process.env.ADMIN_URL || "http://localhost:3001"

test.describe("Admin Profile Management", () => {
  test.beforeAll(async ({ browser }) => {
    authenticatedPage = await createPageWithVideo(browser)
    await authenticateUser(authenticatedPage)
  })

  test.afterAll(async () => {
    await authenticatedPage.close()
  })

  test("Admin can logout @regression", async () => {
    // Add a locator handler to automatically handle login page if it appears
    await authenticatedPage.addLocatorHandler(
      authenticatedPage.getByText("Sign in to your account"),
      async () => {
        await authenticateUser(authenticatedPage)
      },
      { times: 1 },
    )

    await authenticatedPage.goto(`${ADMIN_URL}`)
    await authenticatedPage.waitForLoadState("domcontentloaded")

    await expect(
      authenticatedPage.getByRole("heading", { name: "Send a message" }),
    ).toBeVisible()
    await authenticatedPage.removeLocatorHandler(
      authenticatedPage.getByText("Sign in to your account"),
    )

    await logout(authenticatedPage)
  })
})
