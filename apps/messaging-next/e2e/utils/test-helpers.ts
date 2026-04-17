import { type Page, test } from "@playwright/test"
import { authenticateUser } from "../helpers/auth"
import { createPageWithVideo } from "../helpers/browser-context"

export function setupTestSuite(
  description: string,
  testFunctions: (page: Page) => void,
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

    test.beforeEach(() => {
      // Make authenticatedPage available to each test
      testFunctions(authenticatedPage)
    })
  })
}
