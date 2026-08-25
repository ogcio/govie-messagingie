import { expect, type Page, test } from "@playwright/test"
import { createAuthenticatedPage } from "../helpers/user-auth.helper"

const BASE_URL = process.env.BASE_URL || "http://localhost:3001"
const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3004"

let page: Page

test.describe("User Dashboard Features", () => {
  test.beforeAll(async ({ browser }) => {
    page = await createAuthenticatedPage(browser, "e2e_citizen_1@user.com")
  })

  test.afterAll(async () => {
    await page.close()
  })

  test("a user can view the latest messages on the dashboard @regression", async () => {
    await page.waitForLoadState("networkidle")
    await page.goto(`${DASHBOARD_URL}`)
    await expect(
      page.getByRole("heading", { name: "Welcome back, E2E Citizen User" }),
    ).toBeVisible()
    await expect(page.getByText("Your recent messages")).toBeVisible()
    await expect(page.getByText("View all messages")).toBeVisible()
  })

  test("clicking view all messages will take the user to the messaging page @regression", async () => {
    await page.waitForLoadState("networkidle")
    await page.goto(`${DASHBOARD_URL}`)
    await expect(
      page.getByRole("heading", { name: "Welcome back, E2E Citizen User" }),
    ).toBeVisible()
    await expect(page.getByText("Your recent messages")).toBeVisible()
    await page.getByText("View all messages").click()
    await expect(page.url()).toContain(`${BASE_URL}/en/messages`)
    await expect(page.getByRole("textbox", { name: "Search" })).toBeVisible()
  })

  test("a user can view the latest submissions on the dashboard @regression", async () => {
    await page.waitForLoadState("networkidle")
    await page.goto(`${DASHBOARD_URL}`)
    await expect(
      page.getByRole("heading", { name: "Welcome back, E2E Citizen User" }),
    ).toBeVisible()
    await expect(page.getByText("Your recent submissions")).toBeVisible()
    await expect(page.getByText("View all submissions")).toBeVisible()
  })

  test("clicking view all submissions will take the user to the submissions page @regression", async () => {
    await page.waitForLoadState("networkidle")
    await page.goto(`${DASHBOARD_URL}`)
    await expect(
      page.getByRole("heading", { name: "Welcome back, E2E Citizen User" }),
    ).toBeVisible()
    await expect(page.getByText("Your recent submissions")).toBeVisible()
    await page.getByText("View all submissions").click()
    await expect(page.url()).toContain(`${DASHBOARD_URL}/en/my-submissions`)
    await expect(page.getByRole("textbox", { name: "Search" })).toBeVisible()
  })
  
})
