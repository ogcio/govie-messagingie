import { expect, type Page, test } from "@playwright/test"
import { urls, users } from "../fixtures"
import { createAuthenticatedPage } from "../helpers/user-auth.helper"

const BASE_URL = urls.messaging
const DASHBOARD_URL = urls.dashboard

let page: Page

test.describe("User Dashboard Features", () => {
  test.beforeAll(async ({ browser }) => {
    page = await createAuthenticatedPage(browser, users.citizen1.email)
  })

  test.afterAll(async () => {
    await page.close()
  })

  test("a user can view the latest messages on the dashboard @regression", async () => {
    await page.goto(`${DASHBOARD_URL}`)
    await expect(
      page.getByRole("heading", { name: "Welcome back, E2E Citizen User" }),
    ).toBeVisible()
    await expect(page.getByText("Your recent messages")).toBeVisible()
    await expect(page.getByText("View all messages")).toBeVisible()
  })

  test("clicking view all messages will take the user to the messaging page @regression", async () => {
    await page.goto(`${DASHBOARD_URL}`)
    await expect(
      page.getByRole("heading", { name: "Welcome back, E2E Citizen User" }),
    ).toBeVisible()
    await expect(page.getByText("Your recent messages")).toBeVisible()
    await page.getByText("View all messages").click()
    // `expect(page.url())` is a plain string assertion — it can't wait, so it
    // sampled the URL mid-click. `toHaveURL` retries until the hop lands.
    await expect(page).toHaveURL((url) =>
      url.href.startsWith(`${BASE_URL}/en/messages`),
    )
    // Wait on the inbox by test id, not by role+name: `InboxListChromeHeader`
    // parks the search layer inside an `aria-hidden` wrapper when the bulk
    // toolbar takes the slot, and role queries skip `aria-hidden` subtrees.
    // The point here is only "the inbox rendered", so use the stable handle.
    //
    // The long timeout is the cross-zone hop: messaging only renders once it
    // has its own SAG session, and that redirect chain through auth outlasts
    // the 25s `expect.timeout`.
    await expect(page.getByTestId("search-input")).toBeVisible({
      timeout: 60_000,
    })
  })

  test("a user can view the latest submissions on the dashboard @regression", async () => {
    await page.goto(`${DASHBOARD_URL}`)
    await expect(
      page.getByRole("heading", { name: "Welcome back, E2E Citizen User" }),
    ).toBeVisible()
    await expect(page.getByText("Your recent submissions")).toBeVisible()
    await expect(page.getByText("View all submissions")).toBeVisible()
  })

  test("clicking view all submissions will take the user to the submissions page @regression", async () => {
    await page.goto(`${DASHBOARD_URL}`)
    await expect(
      page.getByRole("heading", { name: "Welcome back, E2E Citizen User" }),
    ).toBeVisible()
    await expect(page.getByText("Your recent submissions")).toBeVisible()
    await page.getByText("View all submissions").click()
    await expect(page).toHaveURL((url) =>
      url.href.startsWith(`${DASHBOARD_URL}/en/my-submissions`),
    )
    await expect(page.getByRole("textbox", { name: "Search" })).toBeVisible()
  })
  
})
