import type { Page } from "@playwright/test"
import { SERVICE_USERS_URL, WAIT_TIME } from "./consts"

export async function updatePublicName(page: Page) {
  const uuid = crypto.randomUUID()
  const newName = `E2E PublicServant User ${uuid}`

  await page.getByTestId("public-name-input").fill(newName)
  await page.getByRole("button", { name: "Update" }).click()

  return newName
}

export async function navigateToServiceUsers(page: Page) {
  // Double navigation needed due to profile redirect
  await page.goto(SERVICE_USERS_URL)
  await page.goto(SERVICE_USERS_URL)
  await page.waitForTimeout(WAIT_TIME)
}
