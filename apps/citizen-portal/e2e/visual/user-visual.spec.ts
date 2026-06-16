import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { createAuthenticatedPage } from "../helpers/user-auth.helper"

let page: Page
const maxDiff = 0.02

test.describe("User Visual Regression", () => {
  test.beforeAll(async ({ browser }) => {
    page = await createAuthenticatedPage(browser, "e2e_citizen_1@user.com")
  })

  test.afterAll(async () => {
    await page.close()
  })

  test("inbox visual snapshot @visual", async () => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    await page.getByRole("textbox", { name: "Search" }).fill("1234567890")
    await page.getByRole("textbox", { name: "Search" }).press("Enter")
    await page.waitForTimeout(2000) // Wait for any dynamic content to load
    await expect(page).toHaveScreenshot("user-inbox.png", {
      fullPage: true,
      maxDiffPixelRatio: maxDiff,
    })
  })

  test("profile page visual snapshot @visual", async () => {
    await page.waitForLoadState("networkidle")

    await page.goto("https://profile.dev.services.gov.ie")
    await page.waitForLoadState("networkidle")
    await expect(page).toHaveScreenshot("user-profile.png", {
      fullPage: true,
      maxDiffPixelRatio: maxDiff,
    })
  })

  test("dashboard page visual snapshot @visual", async () => {
    await page.waitForLoadState("networkidle")

    await page.goto("https://dashboard.dev.services.gov.ie/en/my-dashboard")
    await page.waitForLoadState("networkidle")
    await expect(page).toHaveScreenshot("user-dashboard.png", {
      fullPage: true,
      maxDiffPixelRatio: maxDiff,
    })
  })
})
