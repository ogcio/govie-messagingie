import { expect, test } from "@playwright/test"
import { giveConsent } from "../utils/consent-helper"

test.describe("User Messaging page", () => {
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

  test("a user can accept consent @smoke @regression", async ({ page }) => {
    await giveConsent(page)
    await expect(
      page.getByRole("alert", { name: "Consent Updated" }),
    ).toBeVisible()
    await expect(page.locator("#tab-unread")).toBeVisible()
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
    await expect(page.locator("#tab-unread")).toBeVisible()
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
    await expect(page.locator("#tab-unread")).toBeVisible()
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
    await expect(page.locator("#tab-unread")).toBeVisible()
    await expect(
      page.locator(
        "body > main > div > div > div > div.gi-mb-4 > div > div > p",
      ),
    ).toHaveCount(0)
    //Goto profile page
    await page.goto("https://profile.dev.services.gov.ie")
    /*await page.context().clearCookies({ name: "x-canary" })
    await page.context().addCookies([
      {
        name: "x-canary",
        value: "next",
        path: "/",
        domain: "profile.dev.services.gov.ie",
      },
    ])*/

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
    await expect(page.url()).toContain("messaging.dev.services.gov.ie")

    await expect(
      page.getByText(
        "MessagingIE provides you with a safe and secure access to letters, documents, and messages from Public Sector Bodies (PSBs).",
      ),
    ).toBeVisible()
  })
})
