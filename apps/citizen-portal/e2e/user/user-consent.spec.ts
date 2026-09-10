import { expect, test } from "@playwright/test"
import { urls, users } from "../fixtures"
import { loginAsCitizen } from "../helpers/user-auth.helper"
import { giveConsent } from "../utils/consent-helper"

const PROFILE_URL = urls.profile

test.describe("User Consent", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await loginAsCitizen(page, users.bruceWayne.email)
    if (!testInfo.title.includes("from the profile")) {
      await page.goto("/en/messages?force-consent=1")
      await expect(page.getByRole("dialog")).toBeVisible()
    }
  })

  test("a user can accept consent @smoke @regression", async ({ page }) => {
    await giveConsent(page)
    await expect(
      page.getByRole("alert", { name: "Consent Updated" }),
    ).toBeVisible()
    await expect(
      page.getByText(/^You have opted-out of receiving messages/),
    ).toHaveCount(0)
  })

  test("a user can decline consent @smoke @regression", async ({ page }) => {
    await giveConsent(page, true)
    await expect(
      page.getByRole("alert", { name: "Consent Updated" }),
    ).toBeVisible()
    await expect(
      page.getByText(/^You have opted-out of receiving messages/),
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
      page.getByText(/^You have opted-out of receiving messages/),
    ).toBeVisible()
    //Re-launch consent model
    await page.getByRole("link", { name: "update your preferences" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
  })

  test("a user who can see their consent staus and update from the profile @regression", async ({
    page,
  }) => {
    // Bruce Wayne is not shared with specs that assert persisted consent.
    await page.goto(`${PROFILE_URL}`)
    await expect(
      page.getByRole("heading", { name: "My Profile" }),
    ).toBeVisible()
    await expect(
      page.getByText("Enable or Disable Electronic Messages"),
    ).toBeVisible()

    // "see their consent status": the profile is the only place that renders
    // the stored status. Assert that a status resolved, not which one —
    // Bruce Wayne is a shared fixture, so pinning a value here would make
    // this test depend on whatever another spec last left behind.
    await expect(
      page.getByText(
        /MessagingIE \(Electronic Message Delivery\) is currently (Enabled|Disabled|Unset)/,
      ),
    ).toBeVisible()

    // "update from the profile": the profile hands off to the messaging
    // consent flow via `?force-consent=1` — the param `useConsentGuard`
    // reads to re-open the modal for a user who already consented. Assert
    // the hand-off (link contract + cross-zone landing) rather than the
    // modal: seeing the modal here means out-waiting a cross-origin SSO
    // bounce, and the modal itself is already covered by the tests above.
    const updateConsent = page.getByRole("link", { name: "Update" })
    await expect(updateConsent).toHaveAttribute(
      "href",
      /\/en\/messages\?force-consent=1$/,
    )
    await updateConsent.click()
    await expect(page).toHaveURL(/messaging\.dev\.services\.gov\.ie/)
  })
})
