import { expect, type Page, test } from "@playwright/test"
import {
  createAuthenticatedPage,
  loginAsCitizen,
} from "../helpers/user-auth.helper"
import { buildGlobalSignoutUrl } from "../utils/consts"
import { confirmGlobalSignout, confirmSignout, logout } from "../utils/functions"
import { navigateAndVerifySearch } from "../utils/navigation-helpers"

let page: Page

test.describe("User Features", () => {
  test.beforeAll(async ({ browser }) => {
    page = await createAuthenticatedPage(browser, "e2e_citizen_1@user.com")
  })

  test.afterAll(async () => {
    await page.close()
  })

  test("a user can view footer links @smoke @regression", async () => {
    await page.goto("/")
    await expect(page.getByRole("link", { name: "Privacy" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Cookies" })).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Accessibility statement" }),
    ).toBeVisible()
    await expect(page.getByRole("link", { name: "Terms of use" })).toBeVisible()
  })

  test("a user can switch language @smoke @regression", async () => {
    await page.waitForLoadState("networkidle")

    await page.goto("/ga")
    await expect(page.getByRole("textbox", { name: "Cuardach" })).toBeVisible()
  })

  test("a user can logout @smoke @regression", async () => {
    await navigateAndVerifySearch(page, "/en/messages", "Search")
    await logout(page)
  })

  test("a user can use global signout @smoke @regression", async () => {
    // Logout method used by Payments and Journey Builder, which logs the user out of all sessions
    // Re-establish a session — the menu-logout test above already signed out.
    await page.context().clearCookies()
    await loginAsCitizen(page, "e2e_citizen_1@user.com")

    await navigateAndVerifySearch(page, "/en/messages", "Search")

    const baseURL = process.env.BASE_URL ?? "http://localhost:4001"
    const postRedirectUri = new URL("/en/messages", baseURL).toString()

    await page.goto(buildGlobalSignoutUrl(postRedirectUri))
    await confirmGlobalSignout(page)
  })
})
