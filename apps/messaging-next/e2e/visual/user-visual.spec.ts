import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { createAuthenticatedPage } from "../helpers/user-auth.helper"
import { logout } from "../utils/functions"

let page: Page
const maxDiff = 1.0

test.describe("User Visual Regression", () => {
  test.beforeAll(async ({ browser }) => {
    page = await createAuthenticatedPage(browser, "e2e_citizen_1@user.com")
  })

  test.afterAll(async () => {
    await page.close()
  })

  test.skip("home unread tab visual snapshot @visual", async () => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    await page.getByRole("textbox", { name: "Search" }).fill("1234567890")
    await page.getByRole("button", { name: "Search" }).click()
    await page.waitForTimeout(2000) // Wait for any dynamic content to load
    await expect(page).toHaveScreenshot("user-unread-tab.png", {
      fullPage: true,
      maxDiffPixelRatio: maxDiff,
    })
  })

  test.skip("home all tab page visual snapshot @visual", async () => {
    await page.goto("/")
    await page.getByRole("tab", { name: "All" }).click()
    await page.waitForLoadState("networkidle")
    await page.getByRole("textbox", { name: "Search" }).fill("1234567890")
    await page.getByRole("button", { name: "Search" }).click()
    await page.waitForTimeout(2000) // Wait for any dynamic content to load
    await expect(page).toHaveScreenshot("user-all-tab.png", {
      fullPage: true,
      maxDiffPixelRatio: maxDiff,
    })
  })

  test("profile page visual snapshot @visual", async () => {
    await page.waitForLoadState("networkidle")

    await page.goto("https://profile.dev.services.gov.ie")
    await expect(page).toHaveScreenshot("user-profile.png", {
      fullPage: true,
      maxDiffPixelRatio: maxDiff,
    })
  })

  test("dashboard page visual snapshot @visual", async () => {
    await page.waitForLoadState("networkidle")

    await page.goto("https://dashboard.dev.services.gov.ie/en/my-dashboard")
    await expect(page).toHaveScreenshot("user-dashboard.png", {
      fullPage: true,
      maxDiffPixelRatio: maxDiff,
    })
  })

  test("login page visual snapshot @visual", async () => {
    await page.goto("https://profile.dev.services.gov.ie")
    await logout(page)
    await expect(page).toHaveScreenshot("user-login-page.png", {
      maxDiffPixelRatio: maxDiff,
    })
  })
})
