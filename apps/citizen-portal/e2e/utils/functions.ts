import { expect, type Page } from "@playwright/test"
import { AUTH_SIGN_IN_URL, WAIT_TIME } from "./consts"
import { sendMessageAndVerify } from "./message-helpers"
import { navigateAndVerifyHeading } from "./navigation-helpers"
import { addNewRecipient } from "./recipient-helpers"

const ADMIN_URL = process.env.ADMIN_URL || "http://localhost:3001"
const AUTH_URL = process.env.AUTH_URL || "http://localhost:3002"
const PROFILE_URL = process.env.PROFILE_URL || "http://localhost:3003"

export const generateTestData = () => ({
  uuid: crypto.randomUUID(),
  timestamp: Date.now(),
})

export async function sendE2ETemplateMessage(page: Page, nonSecure = false) {
  await navigateAndVerifyHeading(
    page,
    `${ADMIN_URL}/en/send-a-message`,
    "Send a message",
  )
  await page.selectOption("select#template-select", "Test Template E2E")
  //if nonsecure message click button
  if (nonSecure) {
    await page.getByRole("radio", { name: "Non-secured" }).click()
  }
  await clickButton(page, "Continue to recipients")
}

export async function searchByText(
  page: Page,
  searchText: string,
  searchButtonName = "Search",
) {
  await page.getByRole("textbox", { name: "Search" }).fill(searchText)
  await page.getByRole("button", { name: searchButtonName }).click()
  await page.waitForTimeout(WAIT_TIME)
}

export async function clickButton(page: Page, buttonName: string) {
  await page.getByRole("button", { name: buttonName }).click()
}

export async function logout(page: Page) {
  if (page.url().includes("-admin")) {
    await page.context().clearCookies()
    await page.goto(`/`)
  } else {
    await clickButton(page, "Menu")
    await clickButton(page, "Logout")
    await page.waitForLoadState("networkidle")
  }
  await confirmSignout(page)
}

export async function confirmSignout(page: Page) {
  if (page.url().includes(AUTH_SIGN_IN_URL)) {
    // Click the MyGovID login button
    await page.getByRole("button", { name: "Continue with MyGovId" }).click()
  }
  await expect(page.getByText("Summary")).toBeVisible({
    timeout: 15000,
  })
}

/**
 * Waits for the JB/Payments-style global signout redirect chain to finish.
 * The flow fans out via iframes, posts to SAG, and can take ~30s+.
 */
export async function confirmGlobalSignout(page: Page) {
  await page.waitForURL(
    /sign-in|oidc\/session\/end|global-signout|post-global-signout/,
    { timeout: 90_000 },
  )

  if (
    page.url().includes("global-signout") ||
    page.url().includes("post-global-signout")
  ) {
    await page.waitForURL(/sign-in|oidc\/session\/end/, { timeout: 90_000 })
  }

  await confirmSignout(page)
}

export async function sendMessageToDevCitizen(page: Page, nonSecure = false) {
  await navigateAndVerifyHeading(
    page,
    `${ADMIN_URL}/en/send-a-message`,
    "Send a message",
  )
  await page.selectOption("select#template-select", "Test Template E2E")
  //if nonsecure message click button
  if (nonSecure) {
    await page.getByRole("radio", { name: "Non-secured" }).click()
  }

  await clickButton(page, "Continue to recipients")

  await page.waitForLoadState("domcontentloaded")
  await expect(
    page.getByLabel("Search").getByRole("cell", { name: "List is empty" }),
  ).toBeHidden()

  await page
    .getByRole("tabpanel", { name: "Search" })
    .locator('input[name="email"]')
    .fill("messagingie2@")
  await page.getByRole("button", { name: "Search" }).click()
  await expect(
    page.getByLabel("Search").getByRole("cell", { name: "List is empty" }),
  ).toBeHidden()

  await expect(page.getByRole("cell", { name: "messaging ie2" })).toBeVisible()
  await page
    .getByRole("row", { name: "messaging ie2 <messagingie2@gmail.com>" })
    .getByTestId("govie-icon")
    .click()
  await clickButton(page, "Continue to Attachments")
  await clickButton(page, "Skip")
  await sendMessageAndVerify(page)
}

export async function sendMessageToNewEmailAddress(
  page: Page,
  nonSecure = false,
) {
  await navigateAndVerifyHeading(
    page,
    `${ADMIN_URL}/en/send-a-message`,
    "Send a message",
  )
  await page.selectOption("select#template-select", "Test Template E2E")
  //if nonsecure message click button
  if (nonSecure) {
    await page.getByRole("radio", { name: "Non-secured" }).click()
  }

  await clickButton(page, "Continue to recipients")

  await page.waitForLoadState("domcontentloaded")
  await expect(
    page.getByLabel("Search").getByRole("cell", { name: "List is empty" }),
  ).toBeHidden()

  const email = await addNewRecipient(page)

  await clickButton(page, "Continue to Attachments")
  await clickButton(page, "Skip")
  await sendMessageAndVerify(page)
  return email.recipientEmail
}
