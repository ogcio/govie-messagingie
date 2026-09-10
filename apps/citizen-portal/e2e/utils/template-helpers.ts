import type { Page } from "@playwright/test"
import { templates } from "../fixtures"
import { TEST_DATA } from "./consts"
import { generateTestData } from "./functions"

export async function fillTemplateForm(page: Page, templateName?: string) {
  const { timestamp } = generateTestData()
  const name = templateName || `${templates.playwrightPrefix} ${timestamp}`

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

  return { templateName: name }
}
