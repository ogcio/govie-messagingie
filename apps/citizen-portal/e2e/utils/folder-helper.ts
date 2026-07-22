import type { Page } from "@playwright/test"

export async function createFolder(page: Page, folderName: string) {
  await page.getByRole("button", { name: "Create new folder" }).click()
  await page.getByRole("textbox", { name: "Folder Name" }).fill(folderName)
  await page.getByRole("button", { name: "Save" }).click()
}

export async function cancelCreateFolder(page: Page, folderName: string) {
  await page.getByRole("button", { name: "Create new folder" }).click()
  await page.getByRole("textbox", { name: "Folder Name" }).fill(folderName)
  await page.getByRole("button", { name: "Cancel" }).click()
}

export async function renameFolder(page: Page, folderName: string) {
  await page.getByRole("button", { name: `Options for ${folderName}` }).click()
  await page.getByTestId("edit").click()
  await page.getByRole("textbox", { name: "Folder Name" }).fill(`Renamed ${folderName}`)
  await page.getByRole("button", { name: "Save" }).click()
}

export async function deleteFolder(page: Page, folderName: string) {
  await page.getByRole("button", { name: `Options for ${folderName}` }).click()
  await page.getByTestId("delete").click()
  await page.getByRole("button", { name: "Delete" }).click()
}