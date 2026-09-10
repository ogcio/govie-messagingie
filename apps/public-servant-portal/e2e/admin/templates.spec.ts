import { expect, type Page, test } from "@playwright/test"
import { templates, urls } from "../fixtures"
import { authenticateUser } from "../helpers/auth"
import { createPageWithVideo } from "../helpers/browser-context"
import { generateTestData } from "../utils/functions"
import { createTemplate, deleteTemplate } from "../utils/template-helpers"

let authenticatedPage: Page

const ADMIN_URL = urls.admin

test.describe("Admin Message Templates", () => {
  test.beforeAll(async ({ browser }) => {
    authenticatedPage = await createPageWithVideo(browser)
    await authenticateUser(authenticatedPage)
  })

  test.afterAll(async () => {
    await authenticatedPage.close()
  })

  test("an admin can create a message template and then delete this @regression", async () => {
    const { timestamp } = generateTestData()
    const templateName = `${templates.playwrightPrefix} ${timestamp}`
    const createdName = await createTemplate(authenticatedPage, templateName)

    await deleteTemplate(authenticatedPage, createdName)
  })

  test("Admin can edit a message template created by this test @regression", async () => {
    const templateName = await createTemplate(authenticatedPage)
    const updatedName = `Updated name ${crypto.randomUUID()}`

    await authenticatedPage.goto(`${ADMIN_URL}/en/message-templates`)
    await authenticatedPage
      .getByRole("row")
      .filter({ hasText: templateName })
      .getByRole("link", { name: "Edit" })
      .click()
    await authenticatedPage
      .getByRole("textbox", { name: "Template name" })
      .first()
      .fill(updatedName)
    await authenticatedPage.getByRole("button", { name: "Update" }).click()
    await expect(
      authenticatedPage.getByRole("row").filter({ hasText: updatedName }),
    ).toBeVisible()

    await deleteTemplate(authenticatedPage, updatedName)
  })

  test("An admin can click use this template and be taken to the send a message page @regression", async () => {
    const templateName = await createTemplate(authenticatedPage)

    try {
      await authenticatedPage.goto(`${ADMIN_URL}/en/message-templates`)
      const templateRow = authenticatedPage
        .getByRole("row")
        .filter({ hasText: templateName })
      await templateRow.getByRole("link", { name: "Use this template" }).click()
      await expect(
        authenticatedPage.getByRole("heading", { name: "Send a message" }),
      ).toBeVisible()
      await expect(
        authenticatedPage.getByRole("option", { selected: true }),
      ).toContainText(templateName)
    } finally {
      await deleteTemplate(authenticatedPage, templateName)
    }
  })
})
