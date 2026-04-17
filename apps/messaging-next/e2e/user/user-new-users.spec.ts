import { expect, test } from "@playwright/test"
import { setSafeLevel, setSafeLevelAndUser } from "../helpers/user-auth.helper"
import { generateTestData, logout } from "../utils/functions"

test.describe("User Messaging page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await page
      .getByRole("button", { name: "MyGovId (MyGovId connector)" })
      .click()
  })

  test("a user with safe level 2 can create an account @regression", async ({
    page,
  }) => {
    await setSafeLevel(page, "2")
    await expect(
      page.locator("body > div.gi-modal.gi-modal-open"),
    ).toBeVisible()
  })

  test("a user with safe level 1 cannot create a full account @regression", async ({
    page,
  }) => {
    await setSafeLevel(page, "1")
    await expect(
      page.locator("body > main > div > div > div > div > h1").first(),
    ).toHaveText("Complete Your MyGovID Account Verification to Proceed")
  })

  test("a user with safe level 0 cannot create a full account @regression", async ({
    page,
  }) => {
    await setSafeLevel(page, "0")
    await expect(
      page.locator("body > main > div > div > div > div > h1").first(),
    ).toHaveText("Complete Your MyGovID Account Verification to Proceed")
  })

  test("a user with safe level 1 can upgrade to safe level 2 to gain full access @regression", async ({
    page,
  }) => {
    const { uuid } = generateTestData()
    const userEmail = `testAccount+${uuid}@mail.ie`
    await setSafeLevelAndUser(page, "1", userEmail)
    await expect(
      page.locator("body > main > div > div > div > div > h1").first(),
    ).toHaveText("Complete Your MyGovID Account Verification to Proceed")
    await logout(page)
    await page.goto("/")
    await page
      .getByRole("button", { name: "MyGovId (MyGovId connector)" })
      .click()
    await setSafeLevelAndUser(page, "2", userEmail)
    await expect(
      page.locator("body > div.gi-modal.gi-modal-open"),
    ).toBeVisible()
  })

  test("a user with safe level 0 can upgrade to safe level 2 to gain full access @regression", async ({
    page,
  }) => {
    const { uuid } = generateTestData()
    const userEmail = `testAccount+${uuid}@mail.ie`
    await setSafeLevelAndUser(page, "0", userEmail)
    await expect(
      page.locator("body > main > div > div > div > div > h1").first(),
    ).toHaveText("Complete Your MyGovID Account Verification to Proceed")
    await logout(page)
    await page.goto("/")
    await page
      .getByRole("button", { name: "MyGovId (MyGovId connector)" })
      .click()
    await setSafeLevelAndUser(page, "2", userEmail)
    await expect(
      page.locator("body > div.gi-modal.gi-modal-open"),
    ).toBeVisible()
  })

  test("a user with safe level 2 can access the dashboard @regression", async ({
    page,
  }) => {
    await setSafeLevel(page, "2")
    await page.goto("https://dashboard.dev.services.gov.ie")
    await expect(page.getByText("Your messages")).toBeVisible()
  })

  test("a user with safe level 1 cannot access the dashboard @regression", async ({
    page,
  }) => {
    await setSafeLevel(page, "1")
    await page.goto("https://dashboard.dev.services.gov.ie")
    await expect(
      page.locator("body > main > div > div > div > div > h1").first(),
    ).toHaveText("Complete Your MyGovID Account Verification to Proceed")
  })

  test("a user with safe level 0 access the dashboard @regression", async ({
    page,
  }) => {
    await setSafeLevel(page, "0")
    await page.goto("https://dashboard.dev.services.gov.ie")
    await expect(
      page.locator("body > main > div > div > div > div > h1").first(),
    ).toHaveText("Complete Your MyGovID Account Verification to Proceed")
  })

  test("a user with safe level 2 can access the profile @regression", async ({
    page,
  }) => {
    await setSafeLevel(page, "2")
    await page.goto("https://profile.dev.services.gov.ie")
    await expect(
      page.getByText(
        "The information below includes everything we have sourced from your MyGovID and currently have on file.",
      ),
    ).toBeVisible()
  })

  test("a user with safe level 1 cannot access the profile @regression", async ({
    page,
  }) => {
    await setSafeLevel(page, "1")
    await page.goto("https://profile.dev.services.gov.ie")
    await expect(
      page.locator("body > main > div > div > div > div > h1").first(),
    ).toHaveText("Complete Your MyGovID Account Verification to Proceed")
  })

  test("a user with safe level 0 cannot access the profile @regression", async ({
    page,
  }) => {
    await setSafeLevel(page, "0")
    await page.goto("https://profile.dev.services.gov.ie")
    await expect(
      page.locator("body > main > div > div > div > div > h1").first(),
    ).toHaveText("Complete Your MyGovID Account Verification to Proceed")
  })
})
