import { expect, test } from "@playwright/test"
import { createAuthenticatedPage } from "../helpers/user-auth.helper"

const ATTACHMENT_ONLY_MESSAGE = {
  id: "e2e-msg-attachment-only",
  subject: "",
  createdAt: "2026-04-17T10:00:00Z",
  threadName: "Department of Education",
  organisationId: "org-edu",
  recipientUserId: "peter.parker",
  excerpt: "",
  plainText: "",
  richText: null,
  isSeen: false,
  attachments: ["att-1"],
}

const REGULAR_MESSAGE = {
  id: "e2e-msg-regular",
  subject: "Payslip for Mark Murphy",
  createdAt: "2026-04-17T10:00:00Z",
  threadName: "Department of Education",
  organisationId: "org-edu",
  recipientUserId: "peter.parker",
  excerpt: "Please find attached",
  plainText: "Mark Murphy,\n\nPlease find attached your payslip.",
  isSeen: false,
  attachments: ["att-1"],
}

type StubOptions = {
  onDelete?: (ids: string[]) => void
  deleteFails?: boolean
}

async function stubDetailApis(
  page: Awaited<ReturnType<typeof createAuthenticatedPage>>,
  message: typeof REGULAR_MESSAGE,
  options: StubOptions = {},
) {
  const { onDelete, deleteFails = false } = options

  await page.route("**/messaging/api/v1/messages*", async (route, request) => {
    const url = request.url()
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
    if (request.method() === "DELETE") {
      const body = request.postDataJSON() as { ids: string[] } | null
      onDelete?.(body?.ids ?? [])
      if (deleteFails) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: { message: "Delete failed" } }),
        })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { ids: body?.ids ?? [] }, error: null }),
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
          id: "att-1",
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

test.describe("Message detail page @local", () => {
  test("renders From, To, Date, body, and attachment on a regular message", async ({
    browser,
  }) => {
    const page = await createAuthenticatedPage(browser, "peter.parker@mail.ie")
    await stubDetailApis(page, REGULAR_MESSAGE)

    await page.goto(`/en/messages?id=${REGULAR_MESSAGE.id}`)

    await expect(
      page.getByRole("heading", { name: "Payslip for Mark Murphy" }),
    ).toBeVisible()
    await expect(page.getByText("From", { exact: true })).toBeVisible()
    await expect(page.getByText("Department of Education")).toBeVisible()
    await expect(page.getByText("Date", { exact: true })).toBeVisible()
    await expect(page.getByText("17 April 2026")).toBeVisible()
    await expect(
      page.getByText("Please find attached your payslip."),
    ).toBeVisible()
    await expect(
      page.getByText("Payslip - Mark Murphy - 26-03-2026.pdf"),
    ).toBeVisible()
    await expect(page.getByTestId("attachment-download-action")).toBeVisible()

    await page.close()
  })

  test("detail delete: confirm and show success toast", async ({ browser }) => {
    const page = await createAuthenticatedPage(browser, "peter.parker@mail.ie")
    const deletedIds: string[][] = []
    await stubDetailApis(page, REGULAR_MESSAGE, {
      onDelete: (ids) => deletedIds.push(ids),
    })

    await page.goto(`/en/messages?id=${REGULAR_MESSAGE.id}`)
    await page.getByTestId("detail-delete-button").click()
    await page.getByTestId("delete-confirmation-confirm").click()

    await expect(page.getByTestId("delete-success-toast")).toBeVisible()
    expect(deletedIds.flat()).toContain(REGULAR_MESSAGE.id)

    await page.close()
  })

  test("detail delete: cancel keeps the user on the detail page", async ({
    browser,
  }) => {
    const page = await createAuthenticatedPage(browser, "peter.parker@mail.ie")
    await stubDetailApis(page, REGULAR_MESSAGE)

    await page.goto(`/en/messages?id=${REGULAR_MESSAGE.id}`)
    await page.getByTestId("detail-delete-button").click()
    await expect(page.getByTestId("delete-confirmation-modal")).toBeVisible()
    await page.getByTestId("delete-confirmation-cancel").click()

    await expect(page.getByTestId("delete-confirmation-modal")).toHaveCount(0)
    await expect(
      page.getByRole("heading", { name: "Payslip for Mark Murphy" }),
    ).toBeVisible()

    await page.close()
  })

  test("detail delete: failure shows danger toast", async ({ browser }) => {
    const page = await createAuthenticatedPage(browser, "peter.parker@mail.ie")
    await stubDetailApis(page, REGULAR_MESSAGE, { deleteFails: true })

    await page.goto(`/en/messages?id=${REGULAR_MESSAGE.id}`)
    await page.getByTestId("detail-delete-button").click()
    await page.getByTestId("delete-confirmation-confirm").click()

    await expect(page.getByTestId("delete-failure-toast")).toBeVisible()

    await page.close()
  })

  test("detail move: pick folder and show success toast", async ({
    browser,
  }) => {
    const page = await createAuthenticatedPage(browser, "peter.parker@mail.ie")
    await stubDetailApis(page, REGULAR_MESSAGE)

    await page.goto(`/en/messages?id=${REGULAR_MESSAGE.id}`)
    await page.getByTestId("detail-move-button").click()
    await expect(page.getByTestId("move-message-modal")).toBeVisible()
    await page
      .getByTestId("move-folder-select")
      .selectOption("mock-folder-ehic")
    await page.getByTestId("move-confirmation-confirm").click()

    await expect(page.getByTestId("move-success-toast")).toBeVisible()

    await page.close()
  })

  test("detail move: cancel closes the modal without redirecting", async ({
    browser,
  }) => {
    const page = await createAuthenticatedPage(browser, "peter.parker@mail.ie")
    await stubDetailApis(page, REGULAR_MESSAGE)

    await page.goto(`/en/messages?id=${REGULAR_MESSAGE.id}`)
    await page.getByTestId("detail-move-button").click()
    await expect(page.getByTestId("move-message-modal")).toBeVisible()
    await page.getByTestId("move-confirmation-cancel").click()

    await expect(page.getByTestId("move-message-modal")).toHaveCount(0)
    await expect(page).toHaveURL(new RegExp(`id=${REGULAR_MESSAGE.id}`))

    await page.close()
  })

  test("mobile move: selecting a folder from the list shows success toast", async ({
    browser,
  }) => {
    const page = await createAuthenticatedPage(browser, "peter.parker@mail.ie")
    await page.setViewportSize({ width: 390, height: 844 })
    await stubDetailApis(page, REGULAR_MESSAGE)

    await page.goto(`/en/messages?id=${REGULAR_MESSAGE.id}`)
    await page.getByTestId("detail-move-button").click()
    await page.getByTestId("move-folder-option-mock-folder-ehic").click()

    await expect(page.getByTestId("move-success-toast")).toBeVisible()

    await page.close()
  })

  test("attachment-only message shows fallback text", async ({ browser }) => {
    const page = await createAuthenticatedPage(browser, "peter.parker@mail.ie")
    await stubDetailApis(page, ATTACHMENT_ONLY_MESSAGE)

    await page.goto(`/en/messages?id=${ATTACHMENT_ONLY_MESSAGE.id}`)
    await expect(
      page.getByText(
        "Please select the attachment(s) to preview your message content",
      ),
    ).toBeVisible()
    await expect(page.getByText("(no subject)")).toBeVisible()

    await page.close()
  })
})
