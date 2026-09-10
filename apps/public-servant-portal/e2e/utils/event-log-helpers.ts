import type { Page } from "@playwright/test"

export async function getDateFromEventLog(page: Page) {
  const date = await page
    .getByRole("cell")
    .filter({ hasText: /^\d{2}\/\d{2}\/\d{4}$/ })
    .first()
    .textContent()
  if (!date) throw new Error("Date not found in table")

  const [day, month, year] = date.split("/")
  return { day, month, year, fullDate: date }
}
