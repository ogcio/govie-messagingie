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

  await page.goto(loginURL)

  if (useMyGovId) {
    // Select MyGovID button
    await page.getByRole("button", { name: "Continue with MyGovId" }).click()
    await page.waitForNavigation()

    // Fill in credentials
    await page.getByLabel("Password").fill("123")
    await page.getByRole("button", { name: /^Login/ }).click()
    await page.waitForURL((url) => url.href !== loginURL)
  } else {
    // Select EntraID button
    await page.getByRole("button", { name: "Continue with EntraID" }).click()
    await page.waitForURL((url) => url.href !== loginURL)
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

  await page.goto(loginURL)

  if (useMyGovId) {
    // Select MyGovID button
    await page.getByRole("button", { name: "Continue with MyGovId" }).click()
    await page.waitForNavigation()

    // Fill in credentials
    await page.getByLabel("Select user").selectOption(username)
    await page.getByLabel("Password").fill("123")
    await page.getByRole("button", { name: /^Login/ }).click()
    await page.waitForURL((url) => url.href !== loginURL)
  } else {
    // Select EntraID button
    await page.getByRole("button", { name: "Continue with EntraID" }).click()
    await page.waitForNavigation()
    // TODO: Implement EntraID login flow once available
  }
}

const auth = {
  loginAsRandomCitizen,
  loginAsSpecificUser,
}

export default auth
