import { expect, test } from "@playwright/test"
import { urls, users } from "../fixtures"
import { loginAsCitizen } from "../helpers/user-auth.helper"

const PROFILE_URL = urls.profile

test.describe("User Profile page", () => {
  test.beforeEach(async ({ page }) => {
    // Signing in with "" looks like "any user will do", but `getUserByEmail`
    // returns undefined for it, so no identity is filled and every run gets a
    // brand-new random citizen with no profile to export. Export needs a
    // seeded, provisioned one.
    await loginAsCitizen(page, users.citizen1.email)
  })

  test("a user can request to export their data @regression", async ({
    page,
  }) => {
    // Bare PROFILE_URL resolves on the first SAG hop document; `/en` is what
    // the destination actually renders (same pattern as the visual specs).
    await page.goto(`${PROFILE_URL}/en`)
    await expect(
      page.getByRole("heading", { name: "My Profile" }),
    ).toBeVisible()

    // citizen1 is shared across nightlies and currently sticks in
    // export-ready. Ready UI also shows the cooldown paragraph, so do not
    // OR those together — Playwright strict mode fails when both match.
    const requestBtn = page.getByRole("button", { name: "Request data export" })
    const readyTitle = page.getByText("Your data export is ready!")
    const downloadBtn = page.getByRole("button", { name: "Download" })

    await expect(requestBtn.or(readyTitle).or(downloadBtn).first()).toBeVisible()

    if (await requestBtn.isVisible()) {
      await requestBtn.click()
      await expect(
        page.getByText(
          "Button will be available again in 30 days after completion",
        ),
      ).toBeVisible()
      return
    }

    await expect(readyTitle).toBeVisible()
    await expect(downloadBtn).toBeVisible()
  })
})
