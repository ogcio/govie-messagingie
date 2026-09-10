import { expect, type Page } from "@playwright/test"
import { templates, urls } from "../fixtures"
import { TEST_DATA } from "./consts"
import { generateTestData } from "./functions"

const TEMPLATES_URL = `${urls.admin}/en/message-templates`

export async function createTemplate(page: Page, templateName?: string) {
  const { timestamp } = generateTestData()
  const name = templateName || `${templates.playwrightPrefix} ${timestamp}`

  await page.goto(`${TEMPLATES_URL}/template`)
  await page.getByText("English").click()
  await page.getByRole("textbox", { name: "Template name" }).fill(name)
  await page
    .getByRole("textbox", { name: "Subject" })
    .fill(TEST_DATA.templateSubject)
  await page
    .getByRole("textbox", { name: "Rich Text" })
    .fill(TEST_DATA.templateRichText)
  await page
    .getByRole("textbox", { name: "Plain text" })
    .fill(TEST_DATA.templatePlainText)
  await page.getByRole("button", { name: "Create" }).click()
  await expect(
    page.getByRole("alert", {
      name: `Your template '${name}' has been successfully added would you like to test it now?`,
    }),
  ).toBeVisible()
  return name
}

export async function deleteTemplate(page: Page, templateName: string) {
  await page.goto(TEMPLATES_URL)
  const row = page.getByRole("row").filter({ hasText: templateName })
  await expect(row).toBeVisible()
  await row.getByRole("button", { name: "Delete" }).click()
  await page.getByRole("button", { name: "Delete", exact: true }).click()
  await expect(row).not.toBeVisible()
}
