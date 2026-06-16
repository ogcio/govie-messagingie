import { type Page, test } from "@playwright/test"
import { getDateFromEventLog } from "../utils/event-log-helpers"
import { searchByText } from "../utils/functions"
import { navigateAndVerifyHeading } from "../utils/navigation-helpers"
import { verifyTableContents } from "../utils/table-helpers"
import { setupTestSuite } from "../utils/test-helpers"

const ADMIN_URL = process.env.ADMIN_URL || "http://localhost:3001"

setupTestSuite("Admin Event Logs", (authenticatedPage: Page) => {
  test("an admin can see the event log page @regression", async () => {
    await navigateAndVerifyHeading(
      authenticatedPage,
      `${ADMIN_URL}/en/message-events`,
      "Event log",
    )
  })

  test("Admin can search for event logs by date @regression", async () => {
    await navigateAndVerifyHeading(
      authenticatedPage,
      `${ADMIN_URL}/en/message-events`,
      "Event Log",
    )
    const { day, month, year } = await getDateFromEventLog(authenticatedPage)
    await searchByText(authenticatedPage, `${day}/${month}/${year}`, "Search")
    await verifyTableContents(authenticatedPage, `${day}/${month}/${year}`)
  })

  test("Admin can search for event logs by text @regression", async () => {
    await navigateAndVerifyHeading(
      authenticatedPage,
      `${ADMIN_URL}/en/message-events`,
      "Event Log",
    )
    await searchByText(authenticatedPage, "Test", "Search")
    await verifyTableContents(authenticatedPage, /test/i)
  })
})
