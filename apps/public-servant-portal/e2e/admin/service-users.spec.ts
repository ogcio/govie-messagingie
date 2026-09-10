import { Buffer } from "node:buffer"
import { randomInt } from "node:crypto"
import path from "node:path"
import { expect, type Page, test } from "@playwright/test"
import { urls } from "../fixtures"
import { authenticateUser } from "../helpers/auth"
import { createPageWithVideo } from "../helpers/browser-context"

const SERVICE_USERS_URL = `${urls.profileAdmin}/service-users`
const TEST_CSV_BLANK_FILENAME = "service-users-blank.csv"
const TEST_CSV_INCORRECT_FILENAME = "service-users-incorrect.csv"
const TEST_CSV_XSS_FILENAME = "service-users-xss.csv"
const PPSN_CHECK_CHARACTERS = "WABCDEFGHIJKLMNOPQRSTUV"

let page: Page

function createPpsn() {
  const digits = Array.from({ length: 7 }, () => randomInt(10))
  const checksum = digits.reduce(
    (sum, digit, index) => sum + digit * (8 - index),
    0,
  )
  return `${digits.join("")}${PPSN_CHECK_CHARACTERS[checksum % 23]}`
}

function createServiceUserImport(partial = false) {
  const id = crypto.randomUUID()
  const firstName = "E2E"
  const lastName = `ServiceUser${id}`
  const email = `e2e-service-user-${id}@example.com`
  const ppsn = createPpsn()
  const fileName = `service-users-${id}.csv`
  const header = partial
    ? "firstName,lastName,email"
    : "firstName,lastName,email,phone,address,city,dateOfBirth,ppsn,preferredLanguage"
  const row = partial
    ? `${firstName},${lastName},${email}`
    : `${firstName},${lastName},${email},+353 1234567,123 Test Street,Dublin,1990-01-01,${ppsn},en`

  return {
    email,
    fileName,
    firstName,
    lastName,
    ppsn,
    file: {
      name: fileName,
      mimeType: "text/csv",
      buffer: Buffer.from(`${header}\n${row}`),
    },
  }
}

async function uploadServiceUser(
  page: Page,
  serviceUser: ReturnType<typeof createServiceUserImport>,
) {
  await page.goto(SERVICE_USERS_URL)
  await page.getByText("Import CSV").click()
  await page.locator('input[type="file"]').setInputFiles(serviceUser.file)
  await page.getByRole("button", { name: "Upload", exact: true }).click()
  await expect(page.getByText("File uploaded successfully.")).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Service User Import Detail" }),
  ).toBeVisible()
}

async function waitForServiceUser(page: Page, email: string) {
  const row = page.getByRole("row").filter({ hasText: email })
  await expect(async () => {
    await page.goto(
      `${SERVICE_USERS_URL}?profiles=${encodeURIComponent(email)}`,
    )
    await expect(row).toBeVisible()
  }).toPass({ timeout: 60_000 })
  return row
}

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
    const serviceUser = createServiceUserImport()

    await uploadServiceUser(page, serviceUser)

    await expect(
      page.getByRole("cell", { name: new RegExp(serviceUser.email) }),
    ).toBeVisible()
    await page.getByText("Back", { exact: true }).click()

    // Click the Imports tab
    await page.getByText("Imports").click()

    await page
      .getByRole("textbox", { name: "Search Imports" })
      .fill(serviceUser.fileName)
    await page.getByRole("button", { name: "Search" }).click()

    await expect(
      page.getByRole("row", { name: serviceUser.fileName }).first(),
    ).toBeVisible()

    await page
      .getByRole("row", { name: serviceUser.fileName })
      .first()
      .getByRole("link")
      .click()

    await expect(
      page.getByRole("heading", { name: "Service User Import Detail" }),
    ).toBeVisible()
    await expect(async () => {
      await page.reload()
      await expect(
        page.getByRole("cell", { name: new RegExp(serviceUser.email) }),
      ).toBeVisible()
    }).toPass()
    const serviceUserRow = await waitForServiceUser(page, serviceUser.email)
    await expect(serviceUserRow).toContainText(serviceUser.email)
    await expect(serviceUserRow).toContainText(serviceUser.ppsn)
    await expect(serviceUserRow).toContainText(serviceUser.firstName)
    await expect(serviceUserRow).toContainText(serviceUser.lastName)
  })

  test("an admin can upload service users using partial data @regression", async () => {
    const serviceUser = createServiceUserImport(true)

    await uploadServiceUser(page, serviceUser)
    await expect(
      page.getByRole("cell", { name: new RegExp(serviceUser.email) }),
    ).toBeVisible()
    await page.getByText("Back", { exact: true }).click()

    // Click the Imports tab
    await page.getByText("Imports").click()

    await page
      .getByRole("textbox", { name: "Search Imports" })
      .fill(serviceUser.fileName)
    await page.getByRole("button", { name: "Search" }).click()

    // Make sure the file name appears in the table
    await expect(
      page.getByRole("row", { name: serviceUser.fileName }).first(),
    ).toBeVisible()

    const serviceUserRow = await waitForServiceUser(page, serviceUser.email)
    await expect(serviceUserRow).toContainText(serviceUser.email)
    await expect(serviceUserRow).toContainText(serviceUser.firstName)
    await expect(serviceUserRow).toContainText(serviceUser.lastName)
  })

  test("an admin cannot upload a blank import @regression", async () => {
    const csvPath = path.join(__dirname, TEST_CSV_BLANK_FILENAME)

    await page.getByText("Import CSV").click()
    await page.locator('input[type="file"]').setInputFiles(csvPath)
    await page.getByRole("button", { name: "Upload", exact: true }).click()
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
      const serviceUser = createServiceUserImport(true)
      await uploadServiceUser(page, serviceUser)
      const serviceUserRow = await waitForServiceUser(page, serviceUser.email)
      await serviceUserRow.getByText("Edit").click()
      await page.locator('input[name="firstName"]').fill("Test")
      //add uuid to the name to make it unique
      const uuid = crypto.randomUUID()
      await page.locator('input[name="lastName"]').fill(`User${uuid}`)
      await page.getByRole("button", { name: "Update" }).click()
      await page.getByText("Back", { exact: true }).click()
      await page
        .getByRole("textbox", { name: "Search Service Users" })
        .fill(uuid)
      await page.getByRole("button", { name: "Search" }).click()
      await expect(
        page.getByRole("cell", { name: `User${uuid}` }),
      ).toBeVisible()
    })
  })
})
