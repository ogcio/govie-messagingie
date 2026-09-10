import { expect, type Page, test } from "@playwright/test"
import { urls, users } from "../fixtures"
import { createAuthenticatedPage } from "../helpers/user-auth.helper"
import { navigateAndVerifySearch } from "../utils/navigation-helpers"

const BASE_URL = urls.messaging
const DASHBOARD_URL = urls.dashboard

let page: Page

test.describe("User Submissions page", () => {
  test.beforeAll(async ({ browser }) => {
    page = await createAuthenticatedPage(browser, users.peterParker.email)})

  test.afterAll(async () => {
    await page.close()
  })

    test("a user can view the submissions page @regression", async () => {

      await page.goto(`${DASHBOARD_URL}/en/my-submissions`)
      await expect(page).toHaveURL(`${DASHBOARD_URL}/en/my-submissions`)
    })

    test("applications redirects to the submissions page @regression", async () => {
      // Cross-zone redirect aborts the original document request
      // (net::ERR_ABORTED). Swallow that and assert the destination URL —
      // the page does land on /my-submissions (build 117050 screenshot).
      await Promise.all([
        page.waitForURL(`${DASHBOARD_URL}/en/my-submissions`),
        page
          .goto(`${DASHBOARD_URL}/en/my-applications`, { waitUntil: "commit" })
          .catch((err: unknown) => {
            if (!/ERR_ABORTED|interrupted/i.test(String(err))) throw err
          }),
      ])
      await expect(page).toHaveURL(`${DASHBOARD_URL}/en/my-submissions`)
    })
})
