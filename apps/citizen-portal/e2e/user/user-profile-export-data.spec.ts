import { expect, test } from "@playwright/test"

test.describe("User Profile page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
    if (
      page.url().includes("https://authorization.dev.services.gov.ie/sign-in")
    ) {
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

    await page.goto("https://profile.dev.services.gov.ie")
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
