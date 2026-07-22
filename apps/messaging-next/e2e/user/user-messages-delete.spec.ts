import { expect, test } from "@playwright/test"
import { createAuthenticatedPage } from "../helpers/user-auth.helper"
import { navigateAndVerifySearch } from "../utils/navigation-helpers"

// These tests exercise the soft-delete UX on the Unified Inbox.
// The list + delete APIs are stubbed so the
// spec is hermetic and runs against the local dev server regardless of the
// backend state.
//
// Tagged `@regression` so it opts in to the regression suite without being
// blocking on every commit.

const SAMPLE_MESSAGES = [
  {
    id: "e2e-msg-1",
    subject: "Delete me",
    createdAt: "2025-04-01T10:00:00Z",
    threadName: "Department of Social Protection",
    organisationId: "org-1",
    recipientUserId: "peter.parker",
    excerpt: "First one to delete",
    isSeen: false,
    attachmentsCount: 0,
  },
  {
    id: "e2e-msg-2",
    subject: "Keep me",
    createdAt: "2025-04-02T10:00:00Z",
    threadName: "Revenue",
    organisationId: "org-2",
    recipientUserId: "peter.parker",
    excerpt: "Second message",
    isSeen: true,
    attachmentsCount: 0,
  },
]

async function stubMessagingApis(
  page: Awaited<ReturnType<typeof createAuthenticatedPage>>,
  onDelete?: (ids: string[]) => void,
) {
  await page.route("**/messaging/api/v1/messages*", async (route, request) => {
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: SAMPLE_MESSAGES,
          metadata: { totalCount: SAMPLE_MESSAGES.length },
          error: null,
        }),
      })
      return
    }
    if (request.method() === "DELETE") {
      const body = request.postDataJSON() as { ids: string[] } | null
      onDelete?.(body?.ids ?? [])
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { ids: body?.ids ?? [] }, error: null }),
      })
      return
    }
    await route.continue()
  })
}

test.describe("Unified Inbox delete @regression", () => {
  test("desktop: selecting a single row and confirming deletes it via the bulk toolbar", async ({
    browser,
  }) => {
    const page = await createAuthenticatedPage(browser, "peter.parker@mail.ie")
    const deletedIds: string[][] = []
    await stubMessagingApis(page, (ids) => deletedIds.push(ids))

    await navigateAndVerifySearch(page, "/en/messages", "Search")

    // There is no per-row trash icon any more; the row checkbox is the
    // entry point for both single and bulk deletes.
    await page.getByTestId("select-row-e2e-msg-1").check()
    await page.getByTestId("bulk-delete-button").click()

    const modal = page.getByTestId("delete-confirmation-modal")
    await expect(modal).toBeVisible()
    await page.getByTestId("delete-confirmation-confirm").click()

    await expect(page.getByTestId("delete-success-toast")).toBeVisible()
    expect(deletedIds.flat()).toContain("e2e-msg-1")

    await page.close()
  })

  test("desktop: bulk toolbar deletes selected messages", async ({
    browser,
  }) => {
    const page = await createAuthenticatedPage(browser, "peter.parker@mail.ie")
    const deletedIds: string[][] = []
    await stubMessagingApis(page, (ids) => deletedIds.push(ids))

    await page.goto("/en/messages")
    await page.getByTestId("select-row-e2e-msg-1").check()
    await page.getByTestId("select-row-e2e-msg-2").check()

    await page.getByTestId("bulk-delete-button").click()
    await page.getByTestId("delete-confirmation-confirm").click()

    await expect(page.getByTestId("delete-success-toast")).toBeVisible()
    expect(deletedIds.flat().sort()).toEqual(["e2e-msg-1", "e2e-msg-2"])

    await page.close()
  })

  test("mobile: Select mode exposes checkboxes and bulk delete", async ({
    browser,
  }) => {
    const page = await createAuthenticatedPage(browser, "peter.parker@mail.ie")
    await page.setViewportSize({ width: 390, height: 844 }) // iPhone 12-ish
    const deletedIds: string[][] = []
    await stubMessagingApis(page, (ids) => deletedIds.push(ids))

    await page.goto("/en/messages")
    await page.getByTestId("mobile-select-button").click()

    // In mobile select mode the dark header shows its own Delete button
    // (testid `bulk-delete-button-mobile`) — distinct from the desktop
    // banner so Playwright strict-mode stays happy across viewports.
    // It starts disabled until a row is actually selected.
    const mobileDelete = page.getByTestId("bulk-delete-button-mobile")
    await expect(mobileDelete).toBeVisible()
    await expect(mobileDelete).toBeDisabled()

    // Tap a row to select it in mobile select mode.
    await page
      .getByRole("button", {
        name: /Delete me/i,
      })
      .first()
      .click()

    await expect(mobileDelete).toBeEnabled()
    await mobileDelete.click()
    await page.getByTestId("delete-confirmation-confirm").click()

    await expect(page.getByTestId("delete-success-toast")).toBeVisible()
    expect(deletedIds.flat()).toContain("e2e-msg-1")

    await page.close()
  })

  test("mobile: Close button exits select mode and clears selection", async ({
    browser,
  }) => {
    const page = await createAuthenticatedPage(browser, "peter.parker@mail.ie")
    await page.setViewportSize({ width: 390, height: 844 })
    await stubMessagingApis(page)

    await page.goto("/en/messages")
    await page.getByTestId("mobile-select-button").click()
    await page
      .getByRole("button", { name: /Delete me/i })
      .first()
      .click()

    await page.getByTestId("mobile-select-close").click()

    // Select mode should be off, so the Select button is back.
    await expect(page.getByTestId("mobile-select-button")).toBeVisible()
    // No mobile delete button because the dark select-header is gone.
    await expect(page.getByTestId("bulk-delete-button-mobile")).toHaveCount(0)

    await page.close()
  })
})
