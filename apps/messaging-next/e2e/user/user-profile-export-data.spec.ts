import { expect, test } from "@playwright/test"

test.describe("User Profile page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await page
      .getByRole("button", { name: "MyGovId (MyGovId connector)" })
      .click()
    await page.getByRole("button", { name: "LOGIN" }).click()
    await page.waitForLoadState("networkidle")
    await page.context().clearCookies({ name: "x-canary" })
    await page.context().addCookies([
      {
        name: "x-canary",
        value: "next",
        path: "/",
        domain: "messaging.dev.services.gov.ie",
      },
    ])

    await page.reload()
  })

  test("a user can request to export their data @regression", async ({
    page,
  }) => {
    await page.waitForLoadState("networkidle")

    await page.goto("https://profile.dev.services.gov.ie")
    /*await page.context().clearCookies({ name: "x-canary" })
    await page.context().addCookies([
      {
        name: "x-canary",
        value: "next",
        path: "/",
        domain: "profile.dev.services.gov.ie",
      },
    ])
    await page.reload()*/

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
