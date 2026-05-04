import { expect, type Page, test } from "@playwright/test"
import { createAuthenticatedPage } from "../helpers/user-auth.helper"

let page: Page

test.describe("User Profile Features", () => {
  test.beforeAll(async ({ browser }) => {
    page = await createAuthenticatedPage(browser, "e2e_citizen_1@user.com")
  })

  test.afterAll(async () => {
    await page.close()
  })

  test("a user can view their profile @regression", async () => {
    await page.waitForLoadState("networkidle")

    await page.goto("https://profile.dev.services.gov.ie")
    await expect(
      page.getByRole("heading", { name: "My Profile" }),
    ).toBeVisible()

    await expect(
      page.getByRole("heading", { name: "Public name" }),
    ).toBeVisible()

    await expect(
      page.getByRole("heading", { name: "Name", exact: true }),
    ).toBeVisible()
    await expect(page.getByText("First name")).toBeVisible()
    await expect(page.getByText("Last name")).toBeVisible()

    await expect(
      page.getByRole("heading", { name: "Contact details" }),
    ).toBeVisible()
    await expect(page.getByText("Email").first()).toBeVisible()
    await expect(page.getByText("e2e_citizen_1@user.com")).toBeVisible()

    await expect(page.getByRole("heading", { name: "PPSN" })).toBeVisible()
    await expect(page.getByText("****")).toBeVisible()
    await page.getByTestId("ppsn-reveal-link").click()
    await expect(page.getByText("****")).not.toBeVisible()
  })

  test("a user can update their public name @regression", async () => {
    await page.waitForLoadState("networkidle")

    await page.goto("https://profile.dev.services.gov.ie")
    await expect(
      page.getByRole("heading", { name: "My Profile" }),
    ).toBeVisible()
    //add a uuid to the public name
    const uuid = crypto.randomUUID()
    await page
      .getByTestId("public-name-input")
      .fill(`E2E Citizen User Updated ${uuid}`)
    await page.getByRole("button", { name: "Update" }).click()
    await expect(page.getByText("Public Name has been updated")).toBeVisible()
    await expect(page.getByTestId("public-name-input")).toHaveValue(
      `E2E Citizen User Updated ${uuid}`,
    )
    await page.getByTestId("public-name-input").fill("E2E Citizen User")
    await page.getByRole("button", { name: "Update" }).click()
  })
})
