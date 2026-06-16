import { expect, type Page, test } from "@playwright/test"
import { authenticateUser } from "../helpers/auth"
import { createPageWithVideo } from "../helpers/browser-context"
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
    await page.goto("/")
    //login as citizen to view the message
    if (
      page.url().includes("https://authorization.dev.services.gov.ie/sign-in")
    ) {
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
    await page
      .locator(
        "body > main > div > div > div > div > div > div > section > div.unified-inbox-table-module__iNj3tG__desktopTable > table > tbody > tr:nth-child(1)",
      )
      .click()

    await expect(
      page.getByText("{{publicName}} {{ppsn}} {{email}}"),
    ).not.toBeVisible()
  })
})
