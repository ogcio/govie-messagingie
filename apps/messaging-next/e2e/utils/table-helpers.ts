import { expect, type Page } from "@playwright/test"

export async function verifyTableContents(
  page: Page,
  expectedContent: string | RegExp,
  skipHeader = true,
) {
  const rows = await page.locator("table tbody tr").all()
  const startIndex = skipHeader ? 1 : 0

  for (let i = startIndex; i < rows.length; i++) {
    await expect(rows[i]).toContainText(expectedContent)
  }
}
