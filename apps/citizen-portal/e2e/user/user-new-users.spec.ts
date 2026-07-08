import { expect, test } from "@playwright/test"
import { setSafeLevel, setSafeLevelAndUser } from "../helpers/user-auth.helper"
import { generateTestData, logout } from "../utils/functions"

const AUTH_URL = process.env.AUTH_URL || "http://localhost:3002"
const PROFILE_URL = process.env.PROFILE_URL || "http://localhost:3003"
const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3004"

test.describe("User Messaging page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
    if (page.url().includes(`${AUTH_URL}`)) {
      // Click the MyGovID login button
      await page.getByRole("button", { name: "Continue with MyGovId" }).click()
    }
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
      page
        .locator(
          "body > main > div > div > div > div > div > output > div > h1",
        )
        .first(),
    ).toHaveText("Complete Your MyGovID Account Verification to Proceed")
  })

  test("a user with safe level 0 cannot create a full account @regression", async ({
    page,
  }) => {
    await setSafeLevel(page, "0")
    await expect(
      page
        .locator(
          "body > main > div > div > div > div > div > output > div > h1",
        )
        .first(),
    ).toHaveText("Complete Your MyGovID Account Verification to Proceed")
  })

  test("a user with safe level 1 can upgrade to safe level 2 to gain full access @regression", async ({
    page,
  }) => {
    const { uuid } = generateTestData()
    const userEmail = `testAccount+${uuid}@mail.ie`
    await setSafeLevelAndUser(page, "1", userEmail)
    await expect(
      page
        .locator(
          "body > main > div > div > div > div > div > output > div > h1",
        )
        .first(),
    ).toHaveText("Complete Your MyGovID Account Verification to Proceed")
    await logout(page)
    await page.goto("/")
    if (page.url().includes(`${AUTH_URL}`)) {
      // Click the MyGovID login button
      await page.getByRole("button", { name: "Continue with MyGovId" }).click()
    }
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
      page
        .locator(
          "body > main > div > div > div > div > div > output > div > h1",
        )
        .first(),
    ).toHaveText("Complete Your MyGovID Account Verification to Proceed")
    await logout(page)
    await page.goto("/")
    if (page.url().includes(`${AUTH_URL}`)) {
      // Click the MyGovID login button
      await page.getByRole("button", { name: "Continue with MyGovId" }).click()
    }
    await setSafeLevelAndUser(page, "2", userEmail)
    await expect(
      page.locator("body > div.gi-modal.gi-modal-open"),
    ).toBeVisible()
  })

  test("a user with safe level 2 can access the dashboard @regression", async ({
    page,
  }) => {
    await setSafeLevel(page, "2")
    await page.goto(`${DASHBOARD_URL}`)
    await expect(page.getByText("Your messages")).toBeVisible()
  })

  test("a user with safe level 1 cannot access the dashboard @regression", async ({
    page,
  }) => {
    await setSafeLevel(page, "1")
    await page.goto(`${DASHBOARD_URL}`)
    await expect(
      page
        .locator(
          "body > main > div > div > div > div > div > output > div > h1",
        )
        .first(),
    ).toHaveText("Complete Your MyGovID Account Verification to Proceed")
  })

  test("a user with safe level 0 cannot access the dashboard @regression", async ({
    page,
  }) => {
    await setSafeLevel(page, "0")
    await page.goto(`${DASHBOARD_URL}`)
    await expect(
      page
        .locator(
          "body > main > div > div > div > div > div > output > div > h1",
        )
        .first(),
    ).toHaveText("Complete Your MyGovID Account Verification to Proceed")
  })

  test("a user with safe level 2 can access the profile @regression", async ({
    page,
  }) => {
    await setSafeLevel(page, "2")
    await page.goto(`${PROFILE_URL}`)
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
    await page.goto(`${PROFILE_URL}`)
    await expect(
      page
        .locator(
          "body > main > div > div > div > div > div > output > div > h1",
        )
        .first(),
    ).toHaveText("Complete Your MyGovID Account Verification to Proceed")
  })

  test("a user with safe level 0 cannot access the profile @regression", async ({
    page,
  }) => {
    await setSafeLevel(page, "0")
    await page.goto(`${PROFILE_URL}`)
    await expect(
      page
        .locator(
          "body > main > div > div > div > div > div > output > div > h1",
        )
        .first(),
    ).toHaveText("Complete Your MyGovID Account Verification to Proceed")
  })
})
