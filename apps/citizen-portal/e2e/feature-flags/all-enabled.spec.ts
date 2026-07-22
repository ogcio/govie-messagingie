import { expect, type Page, test } from "@playwright/test"
import { createAuthenticatedPage } from "../helpers/user-auth.helper"

/**
 * Default deployment (every zone/integration enabled) — the regression
 * guard for AB#39580. Confirms that the feature-flag plumbing leaves the
 * fully-flagged experience intact: both cross-zone links are present and
 * the dashboard ships the recent-messages widget.
 *
 * The disabled-topology variants are exercised by
 * `standalone-topology.spec.ts` under `playwright.flags.config.ts`, which
 * boots a dev server with the flags switched off.
 */
let page: Page

test.describe("Feature flags — fully enabled deployment", () => {
  test.beforeAll(async ({ browser }) => {
    page = await createAuthenticatedPage(browser, "e2e_citizen_1@user.com")
  })

  test.afterAll(async () => {
    await page.close()
  })

  test("the dashboard ships the recent-messages widget @regression", async () => {
    await page.goto("/en/my-dashboard")
    await expect(page.getByText("Your recent messages")).toBeVisible()
    await expect(page.getByText("View all messages")).toBeVisible()
  })

  test("the menu exposes both cross-zone links @regression", async () => {
    await page.goto("/en/my-dashboard")
    await page.getByRole("button", { name: /menu/i }).click()
    await expect(
      page.getByRole("link", { name: "Dashboard" }).first(),
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "MessagingIE" }).first(),
    ).toBeVisible()
  })
})
