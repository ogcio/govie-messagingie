import { expect, type Page } from "@playwright/test"

const AUTH_URL = process.env.AUTH_URL || "http://localhost:3001"
const ADMIN_URL = process.env.ADMIN_URL || "http://localhost:3001"

export async function authenticateUser(page: Page) {
  // Go to the main messaging page which will redirect to auth with mygovid for mock login
  await page.goto(`${ADMIN_URL}`)

  // Wait for redirect to auth service
  await page.waitForURL(`${AUTH_URL}?**`)

  await page.context().clearCookies({ name: "connectorsToShow" })

  await page.reload()

  // Click the MyGovID login button
  await page.getByRole("button", { name: "Continue with MyGovId" }).click()

  // Wait for the MyGovID mock login page
  await page.waitForURL("https://mock-login-service.dev.services.gov.ie/**")

  // Fill in the login form
  await page
    .locator(
      "#login-form > div > div.gi-w-full > div:nth-child(1) > div.gi-accordion > div",
    )
    .click()
  await page.locator("#sub").fill("932d94fc69be147f6fcb")
  await page
    .locator(
      "#login-form > div > div.gi-w-full > div:nth-child(2) > div.gi-accordion > div",
    )
    .click()
  await page.locator("#firstName").fill("e2e_ps1")
  await page.locator("#lastName").fill("user")
  await page.locator("#email").fill("e2e_ps_1@user.com")

  await page.getByRole("button", { name: "LOGIN" }).click()

  // Wait for the redirect chain to complete and return to messaging app
  await page.waitForURL(`${ADMIN_URL}/en/**`)
  await expect(page).toHaveURL(`${ADMIN_URL}/en/send-a-message`)
}
