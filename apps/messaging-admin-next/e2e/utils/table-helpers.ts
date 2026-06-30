import { expect, type Page } from "@playwright/test"

export async function verifyTableContents(
  page: Page,
  expectedContent: string | RegExp,
  skipHeader = true,
) {
  const rows = await page.locator("table tbody tr").all()
  const startIndex = skipHeader ? 1 : 0

  // Guard against a vacuous pass: with no data rows the loop body never
  // runs, so a broken search/filter (or a table that failed to load)
  // would report green. Require at least one row to assert against.
  expect(rows.length).toBeGreaterThan(startIndex)

  for (let i = startIndex; i < rows.length; i++) {
    await expect(rows[i]).toContainText(expectedContent)
  }
}
