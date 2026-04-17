import { expect, type Page } from "@playwright/test"
import { WAIT_TIME } from "./consts"
import { sendMessageAndVerify } from "./message-helpers"
import { navigateAndVerifyHeading } from "./navigation-helpers"
import { addNewRecipient } from "./recipient-helpers"

const ADMIN_URL = process.env.ADMIN_URL || "http://localhost:3001"

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
  await page.goto("https://messaging-admin.dev.services.gov.ie/api/signout")
  //await page.locator("#ItemActionDrawerTrigger-0").click()
  //await clickButton(page, "Logout")
  //await expect(page).toHaveURL("https://profile.dev.services.gov.ie/global-signout/")
  //await expect(page.getByText("We’re logging you out")).toBeVisible()
  //await expect(page.getByText("We’re logging you out")).toBeHidden()
  await expect(page.getByText("Sign in to your account")).toBeVisible({
    timeout: 15000,
  })
}

export async function goToDashboard(page: Page) {
  await page.goto("https://dashboard-admin.dev.services.gov.ie")
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
