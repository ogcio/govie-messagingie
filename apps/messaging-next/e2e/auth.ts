import type { Page } from "@playwright/test"

/**
 * Interface for login options
 */
interface LoginOptions {
  useMyGovId?: boolean
  loginURL: string
}

/**
 * Login as a random citizen using either MyGovId or EntraID
 * @param page - Playwright page object
 * @param options - Login options including URL and auth method
 */
async function loginAsRandomCitizen(
  page: Page,
  options: LoginOptions,
): Promise<void> {
  const { loginURL, useMyGovId = true } = options

  await page.goto(loginURL, { waitUntil: "networkidle" })

  if (useMyGovId) {
    // Select MyGovID button
    await page.locator('button:has(span:text("Continue with MyGovId"))').click()
    await page.waitForNavigation()

    // Fill in credentials
    await page
      .locator("#login-form > div > div:nth-child(9) > input")
      .fill("123")
    await page.locator("#submit_btn").click()
    await page.waitForLoadState("networkidle")
  } else {
    // Select EntraID button
    await page.locator('button:has(span:text("Continue with EntraID"))').click()
    await page.waitForLoadState("networkidle")
    // TODO: Implement EntraID login flow once available
  }
}

/**
 * Login as a specific user using either MyGovId or EntraID
 * @param page - Playwright page object
 * @param username - Specific username to login with
 * @param options - Login options including URL and auth method
 */
async function loginAsSpecificUser(
  page: Page,
  username: string,
  options: LoginOptions,
): Promise<void> {
  const { loginURL, useMyGovId = true } = options

  await page.goto(loginURL, { waitUntil: "networkidle" })

  if (useMyGovId) {
    // Select MyGovID button
    await page.locator('button:has(span:text("Continue with MyGovId"))').click()
    await page.waitForNavigation()

    // Fill in credentials
    await page.selectOption("#user_select", username)
    await page
      .locator("#login-form > div > div:nth-child(9) > input")
      .fill("123")
    await page.locator("#submit_btn").click()
    await page.waitForLoadState("networkidle")
  } else {
    // Select EntraID button
    await page.locator('button:has(span:text("Continue with EntraID"))').click()
    await page.waitForNavigation()
    // TODO: Implement EntraID login flow once available
  }
}

const auth = {
  loginAsRandomCitizen,
  loginAsSpecificUser,
}

export default auth
