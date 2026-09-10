import { expect, type Page, test } from "@playwright/test"
import { contacts, users } from "../fixtures"
import { authenticateUser } from "../helpers/auth"
import { createPageWithVideo } from "../helpers/browser-context"
import { loginAsCitizen } from "../helpers/user-auth.helper"
import { clickButton, logout } from "../utils/functions"
import { sendMessageAndVerify } from "../utils/message-helpers"

let page: Page

test.describe("User Messages page", () => {
  test.beforeAll(async ({ browser }) => {
    page = await createPageWithVideo(browser)
    await authenticateUser(page)
  })

  test.afterAll(async () => {
    await page.close()
  })

  test("a user can see variables in a message @smoke @regression", async () => {
    await page.selectOption(
      "select#template-select",
      "{{publicName}} {{ppsn}} {{email}}",
    )
    await clickButton(page, "Continue to recipients")

    await page.waitForLoadState("domcontentloaded")
    await expect(
      page.getByLabel("Search").getByRole("cell", { name: "List is empty" }),
    ).toBeHidden()

    await page
      .getByRole("tabpanel", { name: "Search" })
      .locator('input[name="email"]')
      .fill(contacts.variableRecipient.email)
    await page.getByRole("button", { name: "Search" }).click()
    await expect(page.getByRole("row").nth(1)).toContainText(
      contacts.variableRecipient.email,
    )
    const addRecipient = page.getByRole("button", { name: "Add recipient" })
    // Both the desktop and mobile row variants carry this same aria-label, and an
    // opted-out recipient renders them disabled. Without this check `.click()`
    // spends the entire test timeout in actionability polling and reports only
    // "target closed", which says nothing about why.
    await expect(addRecipient).toBeEnabled({ timeout: 10_000 })
    await addRecipient.click()
    await clickButton(page, "Continue to Attachments")
    await clickButton(page, "Skip")
    await sendMessageAndVerify(page)

    await logout(page)

    // Read the message back as its recipient. Signing in as anyone else means
    // asserting on an inbox that never received it, which is what this test
    // used to do: it sent to one address and read as another.
    // loginAsCitizen fills the post-logout IdP form in place and drains the
    // callback; do not goto("/") first (that abandons the OIDC interaction).
    await loginAsCitizen(page, users.peterParker.email)
    // loginAsCitizen only lands on some portal host (often the inbox from the
    // logout probe). Hop to messages when needed before looking for rows.
    if (!(await page.getByTestId("search-input").isVisible().catch(() => false))) {
      await page.goto("/en/messages")
    }
    await expect(page.getByTestId("search-input")).toBeVisible()

    // Delivery is eventual; search for the substituted email so we do not
    // depend on the message being the top row of a busy seeded inbox.
    await page.getByTestId("search-input").fill(contacts.variableRecipient.email)
    await page.getByTestId("search-input").press("Enter")
    const deliveredRow = page.getByRole("row").filter({
      hasText: contacts.variableRecipient.email,
    })
    await expect(deliveredRow.first()).toBeVisible({ timeout: 60_000 })
    await deliveredRow.first().click()

    // The message detail view actually rendered (proves we are not on a
    // blank/error page — without this, a message that rendered nothing at
    // all would still pass the negative assertion below).
    await expect(
      page.getByRole("link", { name: "Back", exact: true }),
    ).toBeVisible()

    // The template placeholders were substituted: the raw tokens must not
    // leak into the rendered message body.
    await expect(
      page.getByText("{{publicName}} {{ppsn}} {{email}}"),
    ).not.toBeVisible()
  })
})
