import path from "node:path"
import { expect, type Page, test } from "@playwright/test"
import { stubAuthForDemo } from "./stub-auth-for-demo"

/**
 * Visual capture of the redesigned AttachmentCard states (AB#39711).
 * Stubs auth + APIs so it can render the authenticated message detail
 * against `next dev` (:4001) without the local backend stack.
 *
 * Run: pnpm exec playwright test --config=playwright.demo.config.ts \
 *        e2e/demo/attachment-card-states.spec.ts
 */

const SHOTS_DIR = path.join(__dirname, "screenshots")

const PDF_ATTACHMENT = "10000001-0000-4000-8000-000000000001"
const ZIP_ATTACHMENT = "10000001-0000-4000-8000-000000000002"

const PDF_MESSAGE = {
  id: "00000001-0000-4000-8000-000000000001",
  subject: "Payslip for Mark Murphy",
  createdAt: "2026-04-17T10:00:00Z",
  threadName: "Department of Education",
  organisationId: "org-edu",
  recipientUserId: "peter.parker",
  excerpt: "Please find attached",
  plainText: "Mark Murphy,\n\nPlease find attached your payslip.",
  isSeen: false,
  attachments: [PDF_ATTACHMENT],
}

const ZIP_MESSAGE = {
  ...PDF_MESSAGE,
  id: "00000001-0000-4000-8000-000000000002",
  attachments: [ZIP_ATTACHMENT],
}

// Mutable so individual steps can switch the file-download behaviour.
let fileMode: "success" | "slow" | "fail" = "success"

const METADATA: Record<string, { fileName: string; mimeType: string }> = {
  [PDF_ATTACHMENT]: {
    fileName: "Payslip - Mark Murphy - 26-03-2026.pdf",
    mimeType: "application/pdf",
  },
  [ZIP_ATTACHMENT]: {
    fileName: "Payslip - Mark Murphy - 26-03-2026.zip",
    mimeType: "application/zip",
  },
}

async function stubApis(page: Page) {
  await page.route(/\/messaging\/api\/v1\/messages/, async (route, request) => {
    const url = request.url()
    const message = url.includes(ZIP_MESSAGE.id) ? ZIP_MESSAGE : PDF_MESSAGE
    if (request.method() === "GET" && url.includes(message.id)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: message, error: null }),
      })
      return
    }
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [message],
          metadata: { totalCount: 1 },
          error: null,
        }),
      })
      return
    }
    await route.continue()
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

  await page.route(/\/profile\/api\/v1\/profiles\//, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { publicName: "Mark Murphy" },
        error: null,
      }),
    })
  })

  await page.route(/\/upload\/api\/v1\/metadata\//, async (route, request) => {
    const id = request.url().split("/").pop()?.split("?")[0] ?? ""
    const meta = METADATA[id] ?? METADATA[PDF_ATTACHMENT]
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id,
          fileName: meta.fileName,
          fileSize: 230000,
          mimeType: meta.mimeType,
          key: "k",
          ownerId: "o",
          createdAt: "2026-04-17T10:00:00Z",
        },
        error: null,
      }),
    })
  })

  await page.route(/\/upload\/api\/v1\/files\//, async (route) => {
    if (fileMode === "fail") {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "boom" }),
      })
      return
    }
    if (fileMode === "slow") {
      await new Promise((r) => setTimeout(r, 4000))
    }
    await route.fulfill({
      status: 200,
      contentType: "application/pdf",
      body: Buffer.from("%PDF-1.4 demo"),
    })
  })
}

async function shootCard(page: Page, name: string) {
  const titleRow = page.locator('[class*="titleRow"]').first()
  const download = page.getByTestId("attachment-download-action")
  const tr = await titleRow.boundingBox()
  const dl = await download.boundingBox()
  if (!tr || !dl) throw new Error("could not measure card")
  const pad = 20
  await page.screenshot({
    path: path.join(SHOTS_DIR, `${name}.png`),
    clip: {
      x: Math.max(tr.x - pad, 0),
      y: Math.max(tr.y - pad, 0),
      width: tr.width + pad * 2,
      height: dl.y + dl.height - tr.y + pad * 2,
    },
  })
}

test("attachment card states", async ({ page }) => {
  // Register the broad auth/sag stub first so the more specific
  // messaging/upload/profile stubs (registered after) take precedence.
  await stubAuthForDemo(page)
  await stubApis(page)

  // --- Default ---
  fileMode = "success"
  await page.goto(`/en/messages?id=${PDF_MESSAGE.id}`)
  await expect(
    page.getByRole("heading", { name: "Payslip for Mark Murphy" }),
  ).toBeVisible({ timeout: 60_000 })
  await expect(
    page.getByText("Payslip - Mark Murphy - 26-03-2026.pdf"),
  ).toBeVisible()
  await shootCard(page, "01-default")

  // --- Downloading (slow file route) then Saved to device ---
  fileMode = "slow"
  await page.getByTestId("attachment-download-action").click()
  await expect(page.getByTestId("attachment-status")).toHaveText(
    /Downloading/,
    {
      timeout: 10_000,
    },
  )
  await shootCard(page, "02-downloading")
  await expect(page.getByTestId("attachment-status")).toHaveText(
    /Saved to device/,
    { timeout: 15_000 },
  )
  await shootCard(page, "03-saved")

  // --- Download failed (reset state via reload, then 500) ---
  fileMode = "fail"
  await page.reload()
  await expect(
    page.getByText("Payslip - Mark Murphy - 26-03-2026.pdf"),
  ).toBeVisible({ timeout: 30_000 })
  await page.getByTestId("attachment-download-action").click()
  await expect(page.getByTestId("attachment-status")).toHaveText(
    /Download failed/,
    { timeout: 15_000 },
  )
  await shootCard(page, "04-download-failed")

  // --- Preview unavailable (non-previewable .zip) ---
  await page.goto(`/en/messages?id=${ZIP_MESSAGE.id}`)
  await expect(
    page.getByText("Payslip - Mark Murphy - 26-03-2026.zip"),
  ).toBeVisible({ timeout: 30_000 })
  await page.getByTestId("attachment-preview-action").click()
  await expect(page.getByTestId("attachment-status")).toHaveText(
    /Preview unavailable/,
    { timeout: 10_000 },
  )
  await shootCard(page, "05-preview-unavailable")
})
