import { expect, type Page, test } from "@playwright/test"
import { authenticateUser } from "../helpers/auth"
import { createPageWithVideo } from "../helpers/browser-context"
import { navigateAndVerifyHeading } from "../utils/navigation-helpers"

let authenticatedPage: Page

const ADMIN_URL = process.env.ADMIN_URL || "http://localhost:3001"

test.describe("Admin UI Features", () => {
  test.beforeAll(async ({ browser }) => {
    authenticatedPage = await createPageWithVideo(browser)
    await authenticateUser(authenticatedPage)
  })

  test.afterAll(async () => {
    await authenticatedPage.close()
  })

  test("after login an admin lands on the send a message page @smoke @regression", async () => {
    await navigateAndVerifyHeading(
      authenticatedPage,
      `${ADMIN_URL}`,
      "Send a message",
    )
  })

  test("Admin can view footer links @smoke @regression", async () => {
    await authenticatedPage.goto(`${ADMIN_URL}`)
    await expect(
      authenticatedPage.getByRole("link", { name: "Privacy" }),
    ).toBeVisible()
    await expect(
      authenticatedPage.getByRole("link", { name: "Cookies" }),
    ).toBeVisible()
    await expect(
      authenticatedPage.getByRole("link", { name: "Accessibility statement" }),
    ).toBeVisible()
    await expect(
      authenticatedPage.getByRole("link", { name: "Terms of use" }),
    ).toBeVisible()
  })

  test("an admin can switch language @regression", async () => {
    await authenticatedPage.goto(`${ADMIN_URL}/ga`)
    await expect(
      authenticatedPage.getByRole("heading", { name: "Seol teachtaireacht" }),
    ).toBeVisible()
  })
})
