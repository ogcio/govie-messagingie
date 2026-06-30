import path from "node:path"
import { expect, type Page, test } from "@playwright/test"
import { authenticateUser } from "../helpers/auth"
import { createPageWithVideo } from "../helpers/browser-context"
import { clickButton, sendE2ETemplateMessage } from "../utils/functions"
import { scheduleMessage, sendMessageAndVerify } from "../utils/message-helpers"
import { addNewRecipient } from "../utils/recipient-helpers"

const TEST_PDF_FILENAME = "payslip.pdf"

let authenticatedPage: Page

test.describe("Admin Message Sending", () => {
  test.beforeAll(async ({ browser }) => {
    authenticatedPage = await createPageWithVideo(browser)
    await authenticateUser(authenticatedPage)
  })

  test.afterAll(async () => {
    await authenticatedPage.close()
  })

  test("an admin can send a secure message using send now to two recipients @regression", async () => {
    await sendE2ETemplateMessage(authenticatedPage)

    await addNewRecipient(authenticatedPage)
    //add second recipient
    await addNewRecipient(authenticatedPage)

    await clickButton(authenticatedPage, "Continue to Attachments")
    await clickButton(authenticatedPage, "Skip")
    await sendMessageAndVerify(authenticatedPage)
  })

  test("an admin can send a secure message with an attachment @regression", async () => {
    const pdfPath = path.join(__dirname, TEST_PDF_FILENAME)

    await sendE2ETemplateMessage(authenticatedPage)

    await addNewRecipient(authenticatedPage)
    //add second recipient
    await addNewRecipient(authenticatedPage)

    await clickButton(authenticatedPage, "Continue to Attachments")

    await authenticatedPage.locator('input[type="file"]').setInputFiles(pdfPath)
    await expect(
      authenticatedPage.getByText("Attachments uploaded"),
    ).toBeVisible()
    await clickButton(authenticatedPage, "Next")

    await sendMessageAndVerify(authenticatedPage)
  })

  test("an admin can send a secure message using send now to a new recipient @regression", async () => {
    await sendE2ETemplateMessage(authenticatedPage)

    const { recipientName } = await addNewRecipient(authenticatedPage)
    await expect(
      authenticatedPage.getByRole("cell", { name: recipientName }),
    ).toBeVisible()

    await clickButton(authenticatedPage, "Continue to Attachments")
    await clickButton(authenticatedPage, "Skip")
    await sendMessageAndVerify(authenticatedPage)
  })

  test("an admin can send a non secure message using send now @regression", async () => {
    await sendE2ETemplateMessage(authenticatedPage, true)

    const { recipientEmail } = await addNewRecipient(authenticatedPage)
    await expect(
      authenticatedPage.getByRole("cell", { name: recipientEmail }).first(),
    ).toBeVisible()

    await clickButton(authenticatedPage, "Continue to Attachments")
    await clickButton(authenticatedPage, "Skip")
    await sendMessageAndVerify(authenticatedPage)
  })

  test("an admin can send a secure message using schedule @regression", async () => {
    await sendE2ETemplateMessage(authenticatedPage)
    await addNewRecipient(authenticatedPage)
    await clickButton(authenticatedPage, "Continue to Attachments")
    await clickButton(authenticatedPage, "Skip")
    await scheduleMessage(authenticatedPage)
  })

  test("an admin can send a non secure message using schedule @regression", async () => {
    await sendE2ETemplateMessage(authenticatedPage, true)
    await addNewRecipient(authenticatedPage)
    await clickButton(authenticatedPage, "Continue to Attachments")
    await clickButton(authenticatedPage, "Skip")
    await scheduleMessage(authenticatedPage)
  })

  test("an admin can send a non secure message to two recipients using schedule @regression", async () => {
    await sendE2ETemplateMessage(authenticatedPage, true)
    await addNewRecipient(authenticatedPage)
    await addNewRecipient(authenticatedPage)
    await clickButton(authenticatedPage, "Continue to Attachments")
    await clickButton(authenticatedPage, "Skip")
    await scheduleMessage(authenticatedPage)
  })

  test("clicking send another message takes you back to the first page @regression", async () => {
    await sendE2ETemplateMessage(authenticatedPage)
    await authenticatedPage.waitForTimeout(2000)
    await authenticatedPage.getByRole("button", { name: "Add" }).first().click()
    await clickButton(authenticatedPage, "Continue to Attachments")
    await clickButton(authenticatedPage, "Skip")
    await sendMessageAndVerify(authenticatedPage)
    await authenticatedPage
      .getByRole("button", { name: "Send another message" })
      .click()
    await expect(authenticatedPage).toHaveURL(/\/en\/send-a-message/)
    await expect(
      authenticatedPage.getByRole("heading", { name: "Send a message" }),
    ).toBeVisible()
  })
})
