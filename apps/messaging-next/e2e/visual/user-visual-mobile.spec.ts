import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { createAuthenticatedPage } from "../helpers/user-auth.helper"
import { navigateAndVerifyHeading } from "../utils/navigation-helpers"

let page: Page
const maxDiff = 0.02

test.describe("User Visual Regression - Mobile View", () => {
  test.beforeAll(async ({ browser }) => {
    page = await createAuthenticatedPage(browser, "e2e_citizen_1@user.com")
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 }) // iPhone X dimensions
  })

  test.afterAll(async () => {
    await page.context().clearCookies() // Clear cookies to reset state for other tests
    await page.close()
  })

  test("inbox visual snapshot - Mobile View @visual", async () => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    await page.getByRole("textbox", { name: "Search" }).fill("1234567890")
    await page.getByRole("textbox", { name: "Search" }).press("Enter")
    await expect(page).toHaveScreenshot("user-inbox-mobile.png", {
      fullPage: true,
      maxDiffPixelRatio: maxDiff,
    })
  })

  test("profile page visual snapshot - Mobile View @visual", async () => {
    await navigateAndVerifyHeading(
      page,
      "https://profile.dev.services.gov.ie/en",
      "My Profile",
    )
    await expect(page).toHaveScreenshot("user-profile-mobile.png", {
      fullPage: true,
      maxDiffPixelRatio: maxDiff,
    })
  })

  test("dashboard page visual snapshot - Mobile View @visual", async () => {
    await navigateAndVerifyHeading(
      page,
      "https://dashboard.dev.services.gov.ie/en/my-dashboard",
      "Welcome back, E2E Citizen User",
    )
    await expect(page).toHaveScreenshot("user-dashboard-mobile.png", {
      fullPage: true,
      maxDiffPixelRatio: maxDiff,
    })
  })
})
