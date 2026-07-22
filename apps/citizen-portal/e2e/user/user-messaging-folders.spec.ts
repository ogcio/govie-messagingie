import { expect, type Page, test } from "@playwright/test"
import { createPageWithVideo } from "../helpers/browser-context"
import { giveConsent } from "../utils/consent-helper"
import { cancelCreateFolder, createFolder, deleteFolder, renameFolder } from "../utils/folder-helper"

const AUTH_URL = process.env.AUTH_URL || "http://localhost:3002"

let page: Page

test.describe("User Messages page", () => {
  test.beforeAll(async ({ browser }) => {
    page = await createPageWithVideo(browser)
  })

  test.afterAll(async () => {
    await page.close()
  })

  test("a user can create a folder @smoke @regression", async () => {
    await page.goto("/")
    if (page.url().includes(`${AUTH_URL}`)) {
      // Click the MyGovID login button
      await page.getByRole("button", { name: "Continue with MyGovId" }).click()
    }
    await page.getByRole("button", { name: "LOGIN" }).click()
    await page.waitForLoadState("networkidle")
    await giveConsent(page)

    await createFolder(page, "Test Folder")
    await expect(page.getByRole("button", { name: "Options for Test Folder" })).toBeVisible()
  })

  test("a user can cancel folder creation @smoke @regression", async () => {
  await page.goto("/")
    if (page.url().includes(`${AUTH_URL}`)) {
      // Click the MyGovID login button
      await page.getByRole("button", { name: "Continue with MyGovId" }).click()
    }
    await page.getByRole("button", { name: "LOGIN" }).click()
    await page.waitForLoadState("networkidle")
    //Confirm consent
    await giveConsent(page)    
    await cancelCreateFolder(page, "Test Folder")

    await expect(page.getByRole("button", { name: "Options for Test Folder" })).not.toBeVisible()
  })

  test("a user can rename a folder @smoke @regression", async () => {
    await page.goto("/")
    if (page.url().includes(`${AUTH_URL}`)) {
      // Click the MyGovID login button
      await page.getByRole("button", { name: "Continue with MyGovId" }).click()
    }
    await page.getByRole("button", { name: "LOGIN" }).click()
    await page.waitForLoadState("networkidle")
    //Confirm consent
    await giveConsent(page)

    await createFolder(page, "Test Folder")
    await renameFolder(page, "Test Folder")
    await expect(page.getByRole("button", { name: "Options for Renamed Test Folder" })).toBeVisible()
  })

  test("a user can delete a folder @smoke @regression", async () => {
    await page.goto("/")
    if (page.url().includes(`${AUTH_URL}`)) {
      // Click the MyGovID login button
      await page.getByRole("button", { name: "Continue with MyGovId" }).click()
    }
    await page.getByRole("button", { name: "LOGIN" }).click()
    await page.waitForLoadState("networkidle")
    //Confirm consent
    await giveConsent(page)

    await createFolder(page, "Test Folder")
    await deleteFolder(page, "Test Folder")
    await expect(page.getByRole("button", { name: "Options for Test Folder" })).not.toBeVisible()
  })

})
