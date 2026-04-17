import { expect, type Page } from "@playwright/test"

export async function navigateAndVerifyHeading(
  page: Page,
  path: string,
  headingText: string,
) {
  await page.goto(path)
  await expect(page.getByRole("heading", { name: headingText })).toBeVisible()
}
