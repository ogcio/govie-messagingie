import { type Browser, expect, type Page } from "@playwright/test"
import { createPageWithVideo } from "./browser-context"

/**
 * Auth-host signal that tells the helper "we've landed on the Logto
 * sign-in page; click through MyGovId to the mock IdP form".
 *
 * Two recognised shapes:
 *   - dev cluster — `https://authorization.dev.services.gov.ie/sign-in`
 *   - local-auth  — `http://authorization.local.test:8080/sign-in`
 *
 * The default below targets the dev cluster (matches the historical
 * behaviour of this helper); override via the `E2E_AUTH_URL` env var
 * for `test:e2e:local:full` runs (see package.json + docs/testing.md).
 *
 * The MyGovId mock-IdP form is identical between hosted dev and local
 * (`@ogcio/logto-utils/apps/mygovid-mock-service` is the upstream for
 * both), so the locator-driven body below stays unchanged regardless
 * of which auth host we redirect through.
 */
const AUTH_URL =
  process.env.E2E_AUTH_URL?.trim() ||
  "https://authorization.dev.services.gov.ie/sign-in"

export async function loginAsCitizen(
  page: Page,
  citizenName: string,
): Promise<void> {
  // Go to the main page which will redirect to auth
  await page.goto("/")

  if (page.url().includes(AUTH_URL)) {
    // Click the MyGovID login button
    await page.getByRole("button", { name: "Continue with MyGovId" }).click()
  }

  // Fill in the login form
  switch (citizenName) {
    case "e2e_citizen_1@user.com":
      await page
        .locator(
          "#login-form > div > div.gi-w-full > div:nth-child(1) > div.gi-accordion > div",
        )
        .click()
      await page.locator("#sub").fill("zq3e40ff7d558de0ce2e")
      await page
        .locator(
          "#login-form > div > div.gi-w-full > div:nth-child(2) > div.gi-accordion > div",
        )
        .click()
      await page.locator("#firstName").fill("E2E")
      await page.locator("#lastName").fill("Citizen")
      await page.locator("#email").fill("e2e_citizen_1@user.com")
      break
    case "peter.parker@mail.ie":
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
      await page.locator("#firstName").fill("Andrew")
      await page.locator("#lastName").fill("Parker")
      await page.locator("#email").fill("peter.parker@mail.ie")
      break
    case "john.doe@gov.ie":
      await page
        .locator(
          "#login-form > div > div.gi-w-full > div:nth-child(1) > div.gi-accordion > div",
        )
        .click()
      await page.locator("#sub").fill("7ffe40ff7d558de01c67")
      await page
        .locator(
          "#login-form > div > div.gi-w-full > div:nth-child(2) > div.gi-accordion > div",
        )
        .click()
      await page.locator("#firstName").fill("John")
      await page.locator("#lastName").fill("Doe")
      await page.locator("#email").fill("john.doe@gov.ie")
      break
    case "bruce.wayne@mail.ie":
      await page
        .locator(
          "#login-form > div > div.gi-w-full > div:nth-child(1) > div.gi-accordion > div",
        )
        .click()
      await page.locator("#sub").fill("932d94fc69be147fpq3v")
      await page
        .locator(
          "#login-form > div > div.gi-w-full > div:nth-child(2) > div.gi-accordion > div",
        )
        .click()
      await page.locator("#firstName").fill("Alice")
      await page.locator("#lastName").fill("Wayne")
      await page.locator("#email").fill("bruce.wayne@mail.ie")
      break
    default:
      break
  }

  await page.getByRole("button", { name: "LOGIN" }).click()

  // Wait for redirect to complete
  await expect(page).toHaveURL(/.*\/en\//)
}

export async function createAuthenticatedPage(
  browser: Browser,
  citizenName: string,
): Promise<Page> {
  const page = await createPageWithVideo(browser)
  await page.context().clearCookies()
  await loginAsCitizen(page, citizenName)
  return page
}

export async function setSafeLevel(
  page: Page,
  safeLevel: string,
): Promise<void> {
  await page
    .locator(
      "#login-form > div > div.gi-w-full > div:nth-child(3) > div.gi-accordion > div",
    )
    .click()
  await page.locator("#DSPOnlineLevel").fill(safeLevel)
  await page.locator("#DSPOnlineLevelStatic").fill(safeLevel)
  await page.getByRole("button", { name: "LOGIN" }).click()
  await page.waitForLoadState("networkidle")
}

export async function setSafeLevelAndUser(
  page: Page,
  safeLevel: string,
  user: string,
): Promise<void> {
  await page
    .locator(
      "#login-form > div > div.gi-w-full > div:nth-child(2) > div.gi-accordion > div",
    )
    .click()
  await page.locator("#email").fill(user)
  await setSafeLevel(page, safeLevel)
}
