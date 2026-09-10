import { expect, type Page } from "@playwright/test"
import { getUserByEmail, urls, users } from "../fixtures"

async function loginWithAccordionForm(page: Page, citizenName: string) {
  const user = getUserByEmail(citizenName)
  if (user) {
    await page
      .locator(
        "#login-form > div > div.gi-w-full > div:nth-child(1) > div.gi-accordion > div",
      )
      .click()
    await page
      .locator(
        "#login-form > div > div.gi-w-full > div:nth-child(2) > div.gi-accordion > div",
      )
      .click()
    await page.locator("#firstName").fill(user.firstName)
    await page.locator("#lastName").fill(user.lastName)
    await page.locator("#email").fill(user.email)
  }

  await Promise.all([
    page.waitForURL(/\/en\//, { timeout: 120_000 }),
    page.getByRole("button", { name: "LOGIN" }).click(),
  ])
}

async function loginWithUserSelect(page: Page) {
  await page
    .getByLabel("Select user")
    .selectOption({ label: users.peterParker.displayName })
  await page.waitForTimeout(300)
  await page
    .locator('input[type="password"]')
    .fill(users.peterParker.password)
  await Promise.all([
    page.waitForURL(/\/en\//, { timeout: 120_000 }),
    page.getByRole("button", { name: /Login Andrew Parker/ }).click(),
  ])
}

/**
 * Drives whichever MyGovId mock-login UI is in front of us — the hosted
 * dev accordion form or the newer local combobox form.
 */
export async function loginDemo(
  page: Page,
  citizenName = users.peterParker.email,
) {
  await page.goto("/")

  if (
    page.url().includes(urls.authSignIn) ||
    page.url().includes("/sign-in")
  ) {
    const myGovId = page.getByRole("button", { name: "Continue with MyGovId" })
    if (await myGovId.isVisible().catch(() => false)) {
      await myGovId.click()
    }
  }

  const combobox = page.getByLabel("Select user")
  const hasCombobox = await combobox
    .waitFor({ state: "visible", timeout: 30_000 })
    .then(() => true)
    .catch(() => false)

  if (hasCombobox) {
    await loginWithUserSelect(page)
  } else {
    await loginWithAccordionForm(page, citizenName)
  }

  await expect(page).toHaveURL(/\/en\//, { timeout: 120_000 })
}
