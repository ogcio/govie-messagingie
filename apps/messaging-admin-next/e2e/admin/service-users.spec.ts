import path from "node:path"
import { expect, type Page, test } from "@playwright/test"
import { authenticateUser } from "../helpers/auth"
import { createPageWithVideo } from "../helpers/browser-context"

const PROFILE_ADMIN_URL =
  process.env.PROFILE_ADMIN_URL || "http://localhost:3004"
const SERVICE_USERS_URL = `${PROFILE_ADMIN_URL}/en/service-users`
const TEST_CSV_FILENAME = "service-users-template.csv"
const TEST_CSV_PARTIAL_FILENAME = "service-users-partial.csv"
const TEST_CSV_BLANK_FILENAME = "service-users-blank.csv"
const TEST_CSV_INCORRECT_FILENAME = "service-users-incorrect.csv"
const TEST_CSV_XSS_FILENAME = "service-users-xss.csv"

let page: Page

test.describe("Admin Service Users Import Tests", () => {
  test.beforeAll(async ({ browser }) => {
    page = await createPageWithVideo(browser)
    await authenticateUser(page)
    await page.goto(SERVICE_USERS_URL)
    await expect(
      page.getByRole("heading", { name: /service users/i }),
    ).toBeVisible()
  })

  test.afterAll(async () => {
    await page.close()
  })

  test("an admin can upload service users @regression", async () => {
    const csvPath = path.join(__dirname, TEST_CSV_FILENAME)

    await page.getByText("Import CSV").click()
    await page.locator('input[type="file"]').setInputFiles(csvPath)
    await page.getByRole("button", { name: "Upload", exact: true }).click()
    await expect(page.getByText("File uploaded successfully.")).toBeVisible()

    //import details page should show
    await expect(
      page.getByRole("heading", { name: "Service User Import Detail" }),
    ).toBeVisible()
    await expect(
      page.getByRole("cell", {
        name: "Playwright Test Import Test <playwright.import.test@example.com>",
      }),
    ).toBeVisible()
    await page.getByText("Back", { exact: true }).click()

    // Click the Imports tab
    await page.getByText("Imports").click()

    await page
      .getByRole("textbox", { name: "Search Imports" })
      .fill(TEST_CSV_FILENAME)
    await page.getByRole("button", { name: "Search" }).click()

    // Make sure the file name appears in the table
    await expect(
      page.getByRole("row", { name: TEST_CSV_FILENAME }).first(),
    ).toBeVisible()

    await page
      .getByRole("row", { name: TEST_CSV_FILENAME })
      .first()
      .getByRole("link")
      .click()

    // Make sure the new data is visible on the final page
    await expect(
      page.getByRole("heading", { name: "Service User Import Detail" }),
    ).toBeVisible()
    await page.waitForTimeout(3000)
    await page.reload()
    await expect(
      page.getByRole("cell", {
        name: "Playwright Test Import Test <playwright.import.test@example.com>",
      }),
    ).toBeVisible()
    await page.getByText("Back", { exact: true }).click()

    //search for the new user in service users tab
    await page.getByRole("tab", { name: "Service Users" }).click()
    await page
      .getByRole("textbox", { name: "Search Service Users" })
      .fill("Playwright")
    await page.getByRole("button", { name: "Search" }).click()
    //wait for table to load
    await page.waitForTimeout(1000)

    // Check that the new user appears in the table
    await expect(
      page.getByRole("cell", {
        name: "playwright.import.test@example.com",
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole("cell", { name: "1234567T", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("cell", { name: "Playwright Test", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("cell", { name: "Import Test", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("cell", {
        name: "Playwright Test Import Test",
        exact: true,
      }),
    ).toBeVisible()
  })

  test("an admin can upload service users using partial data @regression", async () => {
    const csvPath = path.join(__dirname, TEST_CSV_PARTIAL_FILENAME)

    await page.getByText("Import CSV").click()
    await page.locator('input[type="file"]').setInputFiles(csvPath)
    await page.getByRole("button", { name: "Upload", exact: true }).click()
    await expect(page.getByText("File uploaded successfully.")).toBeVisible()

    //import details page should show
    await expect(
      page.getByRole("heading", { name: "Service User Import Detail" }),
    ).toBeVisible()
    await expect(
      page.getByRole("cell", {
        name: "Playwright Partial Test User <playwright.partial.test@example.com>",
      }),
    ).toBeVisible()
    await page.getByText("Back", { exact: true }).click()

    // Click the Imports tab
    await page.getByText("Imports").click()

    await page
      .getByRole("textbox", { name: "Search Imports" })
      .fill(TEST_CSV_PARTIAL_FILENAME)
    await page.getByRole("button", { name: "Search" }).click()

    // Make sure the file name appears in the table
    await expect(
      page.getByRole("row", { name: TEST_CSV_PARTIAL_FILENAME }).first(),
    ).toBeVisible()

    // Check that the new user appears in the service users tab
    await page.getByRole("tab", { name: "Service Users" }).click()
    await page
      .getByRole("textbox", { name: "Search Service Users" })
      .fill("Playwright Partial")
    await page.getByRole("button", { name: "Search" }).click()
    //wait for table to load
    await page.waitForTimeout(1000)

    // Check that the new user appears in the table with partial data
    await expect(
      page.getByRole("cell", {
        name: "playwright.partial.test@example.com",
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole("cell", { name: "Playwright Partial", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("cell", { name: "Test User", exact: true }),
    ).toBeVisible()
  })

  test("an admin cannot upload a blank import @regression", async () => {
    const csvPath = path.join(__dirname, TEST_CSV_BLANK_FILENAME)

    await page.getByText("Import CSV").click()
    await page.locator('input[type="file"]').setInputFiles(csvPath)
    await page.getByRole("button", { name: "Upload", exact: true }).click()
    await page.waitForLoadState("networkidle")

    // Expect upload to be blocked - should NOT see success message
    await expect(
      page.getByText("File uploaded successfully."),
    ).not.toBeVisible()
  })

  test("an admin cannot upload an incorrect import @regression", async () => {
    const csvPath = path.join(__dirname, TEST_CSV_INCORRECT_FILENAME)

    await page.getByText("Import CSV").click()
    await page.locator('input[type="file"]').setInputFiles(csvPath)
    await page.getByRole("button", { name: "Upload", exact: true }).click()

    // Expect upload to be blocked - should NOT see success message
    await expect(
      page.getByText("File uploaded successfully."),
    ).not.toBeVisible()
  })

  test("an admin cannot upload a file with XSS content @regression", async () => {
    const csvPath = path.join(__dirname, TEST_CSV_XSS_FILENAME)

    await page.getByText("Import CSV").click()
    await page.locator('input[type="file"]').setInputFiles(csvPath)
    await page.getByRole("button", { name: "Upload", exact: true }).click()

    // Expect upload to be blocked - should NOT see success message
    await expect(
      page.getByText("File uploaded successfully."),
    ).not.toBeVisible()
  })

  test.describe("Admin Service Users Edit Test @regression", () => {
    test("an admin can edit a service user @regression", async () => {
      await page.getByRole("tab", { name: "Service Users" }).click()
      await page.getByText("Edit").first().click()
      await page.locator('input[name="firstName"]').fill("Test")
      //add uuid to the name to make it unique
      const uuid = crypto.randomUUID()
      await page.locator('input[name="lastName"]').fill(`User${uuid}`)
      await page.getByRole("button", { name: "Update" }).click()
      await page.waitForLoadState("networkidle")
      await page.getByText("Back", { exact: true }).click()
      await page
        .getByRole("textbox", { name: "Search Service Users" })
        .fill(uuid)
      await page.getByRole("button", { name: "Search" }).click()
      await page.waitForLoadState("networkidle")
      await expect(
        page.getByRole("cell", { name: `User${uuid}` }),
      ).toBeVisible()
    })
  })
})
