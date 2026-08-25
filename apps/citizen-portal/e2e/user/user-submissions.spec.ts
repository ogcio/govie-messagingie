import { expect, type Page, test } from "@playwright/test"
import { createAuthenticatedPage } from "../helpers/user-auth.helper"
import { navigateAndVerifySearch } from "../utils/navigation-helpers"

const BASE_URL = process.env.BASE_URL || "http://localhost:3001"
const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3004"

let page: Page

test.describe("User Submissions page", () => {
  test.beforeAll(async ({ browser }) => {
    page = await createAuthenticatedPage(browser, "peter.parker@mail.ie")})

  test.afterAll(async () => {
    await page.close()
  })

    test("a user can view the submissions page @regression", async () => {

      await page.goto(`${DASHBOARD_URL}/en/my-submissions`)
      await page.waitForLoadState("networkidle")
      await expect(page.url()).toContain(`${DASHBOARD_URL}/en/my-submissions`)
    })

    test("applications redirects to the submissions page @regression", async () => {

      await page.goto(`${DASHBOARD_URL}/en/my-applications`)
      await page.waitForLoadState("networkidle")
      await expect(page.url()).toContain(`${DASHBOARD_URL}/en/my-submissions`)
    })
})
