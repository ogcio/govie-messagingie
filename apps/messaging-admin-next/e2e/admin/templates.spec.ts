import { expect, type Page, test } from "@playwright/test"
import { authenticateUser } from "../helpers/auth"
import { createPageWithVideo } from "../helpers/browser-context"
import { clickButton, generateTestData, searchByText } from "../utils/functions"
import { fillTemplateForm } from "../utils/template-helpers"

let authenticatedPage: Page

const ADMIN_URL = process.env.ADMIN_URL || "http://localhost:3001"

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
    const templateName = `Playwright Template name ${timestamp}`

    await authenticatedPage.goto(`${ADMIN_URL}/en/message-templates/template`)
    await authenticatedPage.getByText("English").click()

    const { templateName: createdName } = await fillTemplateForm(
      authenticatedPage,
      templateName,
    )

    await expect(
      authenticatedPage
        .getByText(
          `Your template '${createdName}' has been successfully added would you like to test it now?`,
        )
        .first(),
    ).toBeVisible()
    /*await expect(
      authenticatedPage.getByRole("cell", { name: createdName }),
    ).toBeVisible()*/
    await authenticatedPage.goto(`${ADMIN_URL}/en/message-templates`)
    await authenticatedPage
      .getByRole("row", { name: `${createdName} EN` })
      .locator("button")
      .last()
      .click()
    //delete the template
    await authenticatedPage
      .getByRole("button", { name: "Delete", exact: true })
      .click()

    await expect(
      authenticatedPage.getByRole("cell", { name: createdName }),
    ).not.toBeVisible()
  })

  test("Admin can search for message templates @regression", async () => {
    await authenticatedPage.goto(`${ADMIN_URL}/en/message-templates`)
    //wait for table content to load
    await authenticatedPage
      .locator("table tbody tr")
      .nth(1)
      .waitFor({ state: "visible" })
    const cellContent = await authenticatedPage
      .getByRole("cell")
      .nth(3)
      .textContent()
    if (cellContent) {
      await searchByText(authenticatedPage, cellContent, "Search")
    } else {
      throw new Error("Cell content is null")
    }
    await authenticatedPage.goto(`${ADMIN_URL}/en/message-templates`)
    await expect(authenticatedPage.getByRole("cell").nth(3)).toContainText(
      cellContent,
    )
  })

  test("Admin can edit an existing message template @regression", async () => {
    const updatedName = `Updated name ${Date.now()}`
    await authenticatedPage.goto(`${ADMIN_URL}/en/message-templates`)
    await authenticatedPage.getByRole("link", { name: "Edit" }).first().click()
    await authenticatedPage
      .getByRole("textbox", { name: "Template name" })
      .first()
      .fill(updatedName)
    await clickButton(authenticatedPage, "Update")
    await authenticatedPage.waitForLoadState("networkidle")
    await searchByText(authenticatedPage, updatedName)
    //await authenticatedPage.goto(`${ADMIN_URL}/en/message-templates`)
    //await searchByText(authenticatedPage, updatedName)
    await expect(
      authenticatedPage.locator(
        "body > main > div > div > div > div > div:nth-child(2) > div > table > tbody > tr > td:nth-child(1) > div",
      ),
    ).toContainText(updatedName)
  })

  test("An admin can click use this template and be taken to the send a message page @regression", async () => {
    await authenticatedPage.goto(`${ADMIN_URL}/en/message-templates`)
    const templateRow = authenticatedPage
      .getByRole("row", {
        name: "Playwright Template name",
      })
      .first()
    await templateRow.getByText("Use this template").click()
    await expect(
      authenticatedPage.getByRole("heading", { name: "Send a message" }),
    ).toBeVisible()

    // Check template is already selected in combobox
    await expect(
      authenticatedPage.getByRole("combobox", { name: "Choose a template" }),
    ).toBeVisible()
    const selectedOption = await authenticatedPage
      .getByRole("option", { selected: true })
      .textContent()
    expect(selectedOption).toContain("Playwright Template name")
  })
})
