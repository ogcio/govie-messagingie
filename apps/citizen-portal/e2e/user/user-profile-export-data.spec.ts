import { expect, test } from "@playwright/test"

const AUTH_URL = process.env.AUTH_URL || "http://localhost:3002"
const PROFILE_URL = process.env.PROFILE_URL || "http://localhost:3003"

test.describe("User Profile page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
    if (page.url().includes(`${AUTH_URL}`)) {
      // Click the MyGovID login button
      await page.getByRole("button", { name: "Continue with MyGovId" }).click()
    }
    await page.getByRole("button", { name: "LOGIN" }).click()
    await page.waitForLoadState("networkidle")
  })

  test("a user can request to export their data @regression", async ({
    page,
  }) => {
    await page.waitForLoadState("networkidle")

    await page.goto(`${PROFILE_URL}`)
    await expect(
      page.getByRole("heading", { name: "My Profile" }),
    ).toBeVisible()
    await page.getByRole("button", { name: "Request data export" }).click()
    await expect(
      page.getByText(
        "Button will be available again in 30 days after completion",
      ),
    ).toBeVisible()
  })
})
