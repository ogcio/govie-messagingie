import { type Page, test } from "@playwright/test"
import { authenticateUser } from "../helpers/auth"
import { createPageWithVideo } from "../helpers/browser-context"
import { createProvider, deleteProvider } from "../utils/providers-helpers"

let authenticatedPage: Page

test.describe("Admin Provider Management", () => {
  test.beforeAll(async ({ browser }) => {
    authenticatedPage = await createPageWithVideo(browser)
    await authenticateUser(authenticatedPage)
  })

  test.afterAll(async () => {
    await authenticatedPage.close()
  })

  test("an admin can add a new provider and then delete them @regression", async () => {
    const { providerName } = await createProvider(authenticatedPage)

    await deleteProvider(authenticatedPage, providerName)
  })
})
