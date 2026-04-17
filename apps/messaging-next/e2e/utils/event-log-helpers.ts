import type { Page } from "@playwright/test"

export async function getDateFromEventLog(page: Page) {
  const date = await page.locator("table tbody tr td").nth(5).textContent()
  if (!date) throw new Error("Date not found in table")

  const [day, month, year] = date.split("/")
  return { day, month, year, fullDate: date }
}
