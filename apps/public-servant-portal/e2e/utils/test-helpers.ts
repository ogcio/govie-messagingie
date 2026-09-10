import { type Page, test } from "@playwright/test"
import { authenticateUser } from "../helpers/auth"
import { createPageWithVideo } from "../helpers/browser-context"

export function setupTestSuite(
  description: string,
  testFunctions: (getPage: () => Page) => void,
) {
  let authenticatedPage: Page

  test.describe(description, () => {
    test.beforeAll(async ({ browser }) => {
      authenticatedPage = await createPageWithVideo(browser)
      await authenticateUser(authenticatedPage)
    })

    test.afterAll(async () => {
      await authenticatedPage.close()
    })

    // Playwright tests must be registered while the suite is declared, not
    // from a hook at execution time.
    testFunctions(() => authenticatedPage)
  })
}
