import type { Page } from "@playwright/test"
import { generateTestData } from "./functions"

export async function addNewRecipient(page: Page) {
  const { uuid } = generateTestData()
  const recipientEmail = `messagingie2+${uuid}@gmail.com`
  const recipientName = `Name${Date.now()}`
  const recipientSurname = `Surname${Date.now()}`

  await page.getByRole("tab", { name: "Add new" }).click()
  const addRecipientForm = page.locator("#addform")
  await addRecipientForm.locator("#firstNameNew").fill(recipientName)
  await addRecipientForm.locator("#surnameNew").fill(recipientSurname)
  await addRecipientForm.locator("#emailNew").fill(recipientEmail)
  await addRecipientForm.getByRole("button", { name: "Add" }).click()

  return { recipientEmail, recipientName, recipientSurname }
}
