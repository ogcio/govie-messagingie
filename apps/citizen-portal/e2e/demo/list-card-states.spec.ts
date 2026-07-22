import fs from "node:fs"
import path from "node:path"
import { expect, type Page, test } from "@playwright/test"
import { stubAuthForDemo } from "./stub-auth-for-demo"

/**
 * Visual capture of the mobile ListCard states (AB#40483).
 *
 * Run: pnpm exec playwright test --config=playwright.demo.config.ts \
 *        e2e/demo/list-card-states.spec.ts
 */

const SHOTS_DIR = path.join(__dirname, "screenshots", "list-card")

const DEMO_MESSAGES = [
  {
    id: "demo-unread-att",
    subject: "Please find attached your payslip for the month of August.",
    createdAt: "2026-07-02T09:00:00Z",
    threadName: "Department of Education",
    organisationId: "org-edu",
    recipientUserId: "demo-user",
    excerpt: "Payslip attached",
    plainText: "Please find attached your payslip.",
    isSeen: false,
    attachmentsCount: 1,
    attachments: ["att-1"],
  },
  {
    id: "demo-read-att",
    subject: "Please find attached your payslip for the month of July.",
    createdAt: "2026-06-30T09:00:00Z",
    threadName: "Department of Education",
    organisationId: "org-edu",
    recipientUserId: "demo-user",
    excerpt: "Payslip attached",
    plainText: "Please find attached your payslip.",
    isSeen: true,
    attachmentsCount: 1,
    attachments: ["att-2"],
  },
  {
    id: "demo-read-no-att",
    subject: "Your annual leave balance has been updated.",
    createdAt: "2026-06-15T09:00:00Z",
    threadName: "Department of Education",
    organisationId: "org-edu",
    recipientUserId: "demo-user",
    excerpt: "Leave balance",
    plainText: "Your leave balance has been updated.",
    isSeen: true,
    attachmentsCount: 0,
    attachments: [],
  },
]

test.use({
  viewport: { width: 375, height: 812 },
})

test.beforeAll(() => {
  fs.mkdirSync(SHOTS_DIR, { recursive: true })
})

test("list card states — static showcase", async ({ page }) => {
  await page.goto("/en/demo/list-card-states")
  await expect(page.getByTestId("list-card-states-demo")).toBeVisible({
    timeout: 60_000,
  })

  await page.screenshot({
    path: path.join(SHOTS_DIR, "01-all-states.png"),
    fullPage: true,
  })

  const cards = page.getByTestId("list-card-states-demo").getByRole("button")
  await expect(cards).toHaveCount(6)

  const labels = [
    "02-unread",
    "03-read",
    "04-select-unchecked",
    "05-selected-unread",
    "06-selected-read",
    "07-read-no-attachment",
  ]

  for (const [index, label] of labels.entries()) {
    const box = await cards.nth(index).boundingBox()
    if (!box) throw new Error(`could not measure card ${index}`)
    await page.screenshot({
      path: path.join(SHOTS_DIR, `${label}.png`),
      clip: {
        x: 0,
        y: Math.max(box.y - 4, 0),
        width: 375,
        height: box.height + 8,
      },
    })
  }
})

async function stubInboxApis(page: Page) {
  await page.route(/\/messaging\/api\/v1\/messages/, async (route, request) => {
    if (request.method() !== "GET") {
      await route.continue()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: DEMO_MESSAGES,
        metadata: { totalCount: DEMO_MESSAGES.length },
        error: null,
      }),
    })
  })

  await page.route(/\/profile\/api\/v1\/organisations\//, async (route) => {
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

  await page.route(/\/messaging\/api\/v1\/tags/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [], error: null }),
    })
  })
}

test("list card states — unified inbox mobile", async ({ page }) => {
  await stubAuthForDemo(page)
  await stubInboxApis(page)

  await page.goto("/en/messages")
  await expect(page.getByTestId("search-input")).toBeVisible({
    timeout: 60_000,
  })
  await expect(
    page.getByRole("button", {
      name: /Please find attached your payslip for the month of August/,
    }),
  ).toBeVisible()

  await page.screenshot({
    path: path.join(SHOTS_DIR, "08-inbox-mobile.png"),
    fullPage: true,
  })

  await page.getByTestId("mobile-select-button").click()
  await page.getByTestId("mobile-select-indicator-demo-unread-att").click()

  await page.screenshot({
    path: path.join(SHOTS_DIR, "09-inbox-select-mode.png"),
    fullPage: true,
  })
})
