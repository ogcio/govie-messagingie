import { expect, type Page } from "@playwright/test"

export async function verifyTableContents(
  page: Page,
  expectedContent: string | RegExp,
) {
  const rows = page.locator("table tbody tr")

  // Wait for the filtered rows and guard against a vacuous pass.
  await expect(rows.first()).toContainText(expectedContent)

  for (let index = 1; index < (await rows.count()); index++) {
    await expect(rows.nth(index)).toContainText(expectedContent)
  }
}
