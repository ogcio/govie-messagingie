import type { Page } from "@playwright/test"
import { generateTestData } from "./functions"

export async function addNewRecipient(page: Page) {
  const { uuid } = generateTestData()
  const recipientEmail = `messagingie2+${uuid}@gmail.com`
  const recipientName = `Name${Date.now()}`
  const recipientSurname = `Surname${Date.now()}`

  await page.getByText("Add new").click()
  await page.locator("#firstNameNew").fill(recipientName)
  await page.locator("#surnameNew").fill(recipientSurname)
  await page.locator("#emailNew").fill(recipientEmail)
  await page.getByRole("button", { name: "Add" }).click()

  return { recipientEmail, recipientName, recipientSurname }
}
