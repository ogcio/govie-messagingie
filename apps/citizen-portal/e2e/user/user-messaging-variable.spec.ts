import { expect, type Page, test } from "@playwright/test"
import { authenticateUser } from "../helpers/auth"
import { createPageWithVideo } from "../helpers/browser-context"
import { clickButton, logout } from "../utils/functions"
import { sendMessageAndVerify } from "../utils/message-helpers"

const AUTH_URL = process.env.AUTH_URL || "http://localhost:3002"

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
      .fill("michael.clarkson+4@nearform.com")
    await page.getByRole("button", { name: "Search" }).click()
    await expect(page.getByRole("row").nth(1)).toContainText(
      "michael.clarkson+4@nearform.com",
    )
    await page.getByRole("button", { name: "Add recipient" }).click()
    await clickButton(page, "Continue to Attachments")
    await clickButton(page, "Skip")
    await sendMessageAndVerify(page)

    await logout(page)

    //login as citizen to view the message
    if (page.url().includes(`${AUTH_URL}`)) {
      // Click the MyGovID login button
      await page.getByRole("button", { name: "Continue with MyGovId" }).click()
    }
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
    await page.locator("#submit_btn").click()
    await page.waitForLoadState("networkidle")

    await expect(page.getByRole("row").nth(1)).toContainText(
      "michael.clarkson+4@nearform.com",
    )
    // First data row (nth(0) is the header). The desktop table's CSS-module
    // class is hashed at build time, so target by ARIA role instead.
    await page.getByRole("row").nth(1).click()

    // The message detail view actually rendered (proves we are not on a
    // blank/error page — without this, a message that rendered nothing at
    // all would still pass the negative assertion below).
    await expect(page.getByRole("link", { name: "Back" })).toBeVisible()

    // The template placeholders were substituted: the raw tokens must not
    // leak into the rendered message body.
    await expect(
      page.getByText("{{publicName}} {{ppsn}} {{email}}"),
    ).not.toBeVisible()
  })
})
