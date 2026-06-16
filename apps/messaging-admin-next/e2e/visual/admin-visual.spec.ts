import { expect, type Page, test } from "@playwright/test"
import { authenticateUser } from "../helpers/auth"
import { createPageWithVideo } from "../helpers/browser-context"

let page: Page
const maxDiff = 0.02

const ADMIN_URL = process.env.ADMIN_URL || "http://localhost:3001"

test.describe("Admin Visual Regression", () => {
  test.beforeAll(async ({ browser }) => {
    page = await createPageWithVideo(browser)
    await authenticateUser(page)
  })

  test.afterAll(async () => {
    await page.close()
  })

  test("admin send a message page visual snapshot @visual", async () => {
    await page.goto(`${ADMIN_URL}/en`)
    await page.waitForLoadState("networkidle")
    await page.selectOption("select#template-select", "Test Template E2E")
    await expect(page).toHaveScreenshot("admin-send-message.png", {
      fullPage: true,
      maxDiffPixelRatio: maxDiff,
    })
  })

  test("admin message templates page visual snapshot @visual", async () => {
    await page.goto(`${ADMIN_URL}/en/message-templates`)
    await page.waitForLoadState("networkidle")
    await expect(page).toHaveScreenshot("admin-message-templates.png", {
      mask: [await page.locator("table")],
      maskColor: "white",
      maxDiffPixelRatio: maxDiff,
    })
  })

  test("admin event log page visual snapshot @visual", async () => {
    await page.goto(`${ADMIN_URL}/en/message-events`)
    await page.waitForLoadState("networkidle")
    await expect(page).toHaveScreenshot("admin-event-log.png", {
      mask: [
        await page.locator("table"),
        await page.getByRole("button", { name: "Go to page" }).last(),
      ],
      maskColor: "white",
      maxDiffPixelRatio: maxDiff,
    })
  })

  test("admin help page visual snapshot @visual", async () => {
    await page.goto(`${ADMIN_URL}/en/help`)
    await page.waitForLoadState("networkidle")
    await expect(page).toHaveScreenshot("admin-help.png", {
      fullPage: true,
      maxDiffPixelRatio: maxDiff,
    })
  })

  test("admin profile page visual snapshot @visual", async () => {
    await page.goto("https://profile-admin.dev.services.gov.ie")
    await page.waitForLoadState("networkidle")
    await expect(page).toHaveScreenshot("admin-profile.png", {
      fullPage: true,
      maxDiffPixelRatio: maxDiff,
    })
  })

  /*Disabled due to flakyness, needs investigation
  test("admin providers page visual snapshot @visual", async () => {
    await page.waitForLoadState("networkidle")
    await page.goto(`${ADMIN_URL}/en/providers`)
    await page.waitForLoadState("networkidle")
    await expect(page).toHaveScreenshot("admin-providers.png", {
      fullPage: true,
      mask: [await page.locator("table")],
      maskColor: "white",
      maxDiffPixelRatio: maxDiff,
    })
  })*/

  test("admin service users page visual snapshot @visual", async () => {
    await page.goto(
      "https://profile-admin.dev.services.gov.ie/en/service-users",
    )
    await page.waitForLoadState("networkidle")
    await expect(page).toHaveScreenshot("admin-service-users.png", {
      mask: [
        await page.locator("table"),
        await page.getByRole("button", { name: "Go to page" }).last(),
      ],
      maskColor: "white",
      maxDiffPixelRatio: maxDiff,
    })
  })

  test("admin service users page Imports tab visual snapshot @visual", async () => {
    await page.goto(
      "https://profile-admin.dev.services.gov.ie/en/service-users",
    )
    await page.getByText("Imports").click()
    await expect(page).toHaveScreenshot("admin-service-users-imports.png", {
      fullPage: true,
      mask: [await page.locator("table")],
      maskColor: "white",
      maxDiffPixelRatio: maxDiff,
    })
  })

  test("admin service users page Import CSV tab visual snapshot @visual", async () => {
    await page.goto(
      "https://profile-admin.dev.services.gov.ie/en/service-users",
    )
    await page.getByText("Import CSV").click()
    await expect(page).toHaveScreenshot("admin-service-users-import-csv.png", {
      fullPage: true,
      mask: [await page.locator("table")],
    })
  })
})
