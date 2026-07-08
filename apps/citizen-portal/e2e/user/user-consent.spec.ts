import { expect, test } from "@playwright/test"
import { giveConsent } from "../utils/consent-helper"

const AUTH_URL = process.env.AUTH_URL || "http://localhost:3002"
const PROFILE_URL = process.env.PROFILE_URL || "http://localhost:3003"

test.describe("User Consent", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
    if (page.url().includes(`${AUTH_URL}`)) {
      // Click the MyGovID login button
      await page.getByRole("button", { name: "Continue with MyGovId" }).click()
    }
    await page.getByRole("button", { name: "LOGIN" }).click()
    //await page.waitForLoadState("networkidle")
    await expect(page).toHaveURL(/messaging\.dev\.services\.gov\.ie/)
  })

  test("a user can accept consent @smoke @regression", async ({ page }) => {
    await giveConsent(page)
    await expect(
      page.getByRole("alert", { name: "Consent Updated" }),
    ).toBeVisible()
    await expect(
      page.locator(
        "body > main > div > div > div > div.gi-mb-4 > div > div > p",
      ),
    ).toHaveCount(0)
  })

  test("a user can decline consent @smoke @regression", async ({ page }) => {
    await giveConsent(page, true)
    await expect(
      page.getByRole("alert", { name: "Consent Updated" }),
    ).toBeVisible()
    await expect(
      page.locator(
        "body > main > div > div > div > div.gi-mb-4 > div > div > p",
      ),
    ).toBeVisible()
  })

  test("a user who has declined consent can update consent @regression", async ({
    page,
  }) => {
    //Decline consent
    await giveConsent(page, true)
    await expect(
      page.getByRole("alert", { name: "Consent Updated" }),
    ).toBeVisible()
    await expect(
      page.locator(
        "body > main > div > div > div > div.gi-mb-4 > div > div > p",
      ),
    ).toBeVisible()
    //Re-launch consent model
    await page
      .locator(
        "body > main > div > div > div > div.gi-mb-4 > div > div > p > a",
      )
      .click()
    await expect(
      page.locator("body > div.gi-modal.gi-modal-open"),
    ).toBeVisible()
  })

  test("a user who can see their consent staus and update from the profile @regression", async ({
    page,
  }) => {
    //Decline consent
    await giveConsent(page)
    await expect(
      page.getByRole("alert", { name: "Consent Updated" }),
    ).toBeVisible()
    await expect(
      page.locator(
        "body > main > div > div > div > div.gi-mb-4 > div > div > p",
      ),
    ).toHaveCount(0)
    //Goto profile page
    await page.goto(`${PROFILE_URL}`)
    await expect(
      page.getByRole("heading", { name: "My Profile" }),
    ).toBeVisible()
    await expect(
      page.getByText("Enable or Disable Electronic Messages"),
    ).toBeVisible()
    //update consent from profile
    await page
      .locator(
        "body > main > div > div > div > article > div > div.gi-flex.gi-w-full.gi-justify-start.gi-items-start.gi-flex-col.gi-gap-4.gi-flex-nowrap > a",
      )
      .click()
    await expect(page).toHaveURL(/messaging\.dev\.services\.gov\.ie/)

    await expect(
      page.locator("body > div.gi-modal.gi-modal-open"),
    ).toBeVisible()
  })
})
