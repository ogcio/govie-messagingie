import { expect, type Page, test } from "@playwright/test"
import { users } from "../fixtures"
import { createPageWithVideo } from "../helpers/browser-context"
import { loginAsCitizen } from "../helpers/user-auth.helper"
import { giveConsent } from "../utils/consent-helper"
import { cancelCreateFolder, createFolder, deleteFolder, isFoldersFeatureEnabled, renameFolder } from "../utils/folder-helper"

let page: Page

// The tests share one page and one citizen account, so folder names have to
// be unique per test: a leftover folder makes another test's "not visible"
// assertion fail, and a duplicate name trips Playwright's strict mode.
const folderName = (suffix: string) => `Test Folder ${Date.now()}-${suffix}`

test.skip(
  !isFoldersFeatureEnabled(),
  "Folder e2e runs only when NEXT_PUBLIC_ENABLE_FOLDERS is on (AB#42582).",
)

test.describe("User Messages page", () => {
  test.beforeAll(async ({ browser }) => {
    page = await createPageWithVideo(browser)
    // Consent is asked once per account, so log in and accept it once here
    // rather than per test.
    await loginAsCitizen(page, users.bruceWayne.email)
    await page.goto("/en/messages?force-consent=1")
    await expect(page.getByRole("dialog")).toBeVisible()
    await giveConsent(page)
  })

  test.afterAll(async () => {
    await page.close()
  })

  test("a user can create a folder @smoke @regression", async () => {
    const name = folderName("create")
    await createFolder(page, name)
    await expect(
      page.getByRole("button", { name: `Options for ${name}` }),
    ).toBeVisible()
    await deleteFolder(page, name)
  })

  test("a user can cancel folder creation @smoke @regression", async () => {
    const name = folderName("cancel")
    await cancelCreateFolder(page, name)
    await expect(
      page.getByRole("button", { name: `Options for ${name}` }),
    ).not.toBeVisible()
  })

  test("a user can rename a folder @smoke @regression", async () => {
    const name = folderName("rename")
    await createFolder(page, name)
    await renameFolder(page, name)
    await expect(
      page.getByRole("button", { name: `Options for Renamed ${name}` }),
    ).toBeVisible()
    await deleteFolder(page, `Renamed ${name}`)
  })

  test("a user can delete a folder @smoke @regression", async () => {
    const name = folderName("delete")
    await createFolder(page, name)
    await deleteFolder(page, name)
    await expect(
      page.getByRole("button", { name: `Options for ${name}` }),
    ).not.toBeVisible()
  })
})
