import { type Browser, expect, type Page } from "@playwright/test"
import { createPageWithVideo } from "./browser-context"

export async function loginAsCitizen(
  page: Page,
  citizenName: string,
): Promise<void> {
  // Go to the main page which will redirect to auth
  await page.goto("/")

  // Click the MyGovID login button
  await page.getByRole("button", { name: "Continue with MyGovId" }).click()

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

  await page.context().clearCookies({ name: "x-canary" })
  await page.context().addCookies([
    {
      name: "x-canary",
      value: "next",
      path: "/",
      domain: "messaging.dev.services.gov.ie",
    },
  ])

  await page.reload()
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
  await page.context().clearCookies({ name: "x-canary" })
  await page.context().addCookies([
    {
      name: "canary",
      value: "next",
      path: "/",
      domain: "messaging.dev.services.gov.ie",
    },
  ])

  await page.reload()
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
