import { expect, test, type Page } from "@playwright/test"
import { loginDemo } from "./login-demo.helper"
import { stubAuthForDemo } from "./stub-auth-for-demo"

const USE_DEV_SAG = process.env.DEMO_USE_DEV_SAG === "1"

async function prepareSession(page: Page) {
  await page.context().clearCookies()
  if (USE_DEV_SAG) {
    await loginDemo(page)
    return
  }
  await stubAuthForDemo(page)
}

const DEMO_MESSAGE = {
  id: "00000001-0000-4000-8000-000000000001",
  subject: "Payslip for Mark Murphy",
  createdAt: "2026-04-17T10:00:00Z",
  threadName: "Department of Education",
  organisationId: "org-edu",
  recipientUserId: "peter.parker",
  excerpt: "Please find attached",
  plainText: "Mark Murphy,\n\nPlease find attached your payslip.",
  isSeen: false,
  attachments: ["10000001-0000-4000-8000-000000000001"],
}

async function stubDetailApis(page: Page) {
  await page.route("**/messaging/api/v1/messages*", async (route, request) => {
    const url = request.url()
    if (request.method() === "GET" && url.includes(DEMO_MESSAGE.id)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: DEMO_MESSAGE, error: null }),
      })
      return
    }
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [DEMO_MESSAGE],
          metadata: { totalCount: 1 },
          error: null,
        }),
      })
      return
    }
    await route.continue()
  })

  await page.route("**/profile/api/v1/organisations/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: "org-edu",
          translations: {
            en: { name: "Department of Education", shortName: "DoE" },
            ga: { name: "An Roinn Oideachais", shortName: "ARO" },
          },
        },
        error: null,
      }),
    })
  })

  await page.route("**/profile/api/v1/profiles/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { publicName: "Mark Murphy" },
        error: null,
      }),
    })
  })

  await page.route("**/upload/api/v1/metadata/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: "10000001-0000-4000-8000-000000000001",
          fileName: "Payslip - Mark Murphy - 26-03-2026.pdf",
          fileSize: 230000,
          mimeType: "application/pdf",
          key: "k",
          ownerId: "o",
          createdAt: "2026-04-17T10:00:00Z",
        },
        error: null,
      }),
    })
  })
}

test("AB#38547 message detail feature walkthrough", async ({ page }) => {
  await stubDetailApis(page)
  await prepareSession(page)

  await page.goto(`/en/messages?id=${DEMO_MESSAGE.id}`)
  await page.waitForTimeout(800)

  await expect(
    page.getByRole("heading", { name: "Payslip for Mark Murphy" }),
  ).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText("Department of Education")).toBeVisible()
  await expect(page.getByText("17 April 2026")).toBeVisible()
  await page.waitForTimeout(1200)

  await page.getByTestId("detail-move-button").click()
  await expect(page.getByTestId("move-message-modal")).toBeVisible()
  await page.waitForTimeout(800)
  await page.getByTestId("move-folder-select").selectOption("mock-folder-ehic")
  await page.waitForTimeout(600)
  await page.getByTestId("move-confirmation-confirm").click()
  await expect(page.getByTestId("move-success-toast")).toBeVisible()
  await page.waitForTimeout(1500)

  await page.getByTestId("detail-delete-button").click()
  await expect(page.getByTestId("delete-confirmation-modal")).toBeVisible()
  await page.waitForTimeout(800)
  await page.getByTestId("delete-confirmation-cancel").click()
  await page.waitForTimeout(1000)
})
