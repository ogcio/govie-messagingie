import { test } from "@playwright/test"
import { urls } from "../fixtures"
import { searchByText } from "../utils/functions"
import { navigateAndVerifyHeading } from "../utils/navigation-helpers"
import { verifyTableContents } from "../utils/table-helpers"
import { setupTestSuite } from "../utils/test-helpers"

const ADMIN_URL = urls.admin

setupTestSuite("Admin Event Logs", (getAuthenticatedPage) => {
  test("an admin can see the event log page @regression", async () => {
    const authenticatedPage = getAuthenticatedPage()
    await navigateAndVerifyHeading(
      authenticatedPage,
      `${ADMIN_URL}/en/message-events`,
      "Event log",
    )
  })

  test("Admin can search for event logs by date @regression", async () => {
    const authenticatedPage = getAuthenticatedPage()
    await navigateAndVerifyHeading(
      authenticatedPage,
      `${ADMIN_URL}/en/message-events`,
      "Event Log",
    )
    const date = new Date().toISOString().slice(0, 10)
    await authenticatedPage.getByRole("textbox", { name: "From" }).fill(date)
    await authenticatedPage.getByRole("textbox", { name: "To" }).fill(date)
    await authenticatedPage.getByRole("button", { name: "Search" }).click()
    await authenticatedPage.waitForURL(
      (url) =>
        url.searchParams.get("dateFrom") === date &&
        url.searchParams.get("dateTo") === date,
    )
  })

  test("Admin can search for event logs by text @regression", async () => {
    const authenticatedPage = getAuthenticatedPage()
    await navigateAndVerifyHeading(
      authenticatedPage,
      `${ADMIN_URL}/en/message-events`,
      "Event Log",
    )
    const subject = await authenticatedPage
      .locator("table tbody tr")
      .first()
      .getByRole("cell")
      .nth(2)
      .textContent()
    if (!subject) throw new Error("Event subject not found in table")

    await searchByText(authenticatedPage, subject, "Search")
    await verifyTableContents(authenticatedPage, subject)
  })
})
