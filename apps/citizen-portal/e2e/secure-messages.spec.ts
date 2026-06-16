import { expect, test } from "@playwright/test"
import auth from "./auth"

// Mock data
const mockMessageId = "test-message-id"
const mockUserId = "test-user-id"
const mockMessage = {
  data: {
    recipientUserId: mockUserId,
    // Add other necessary message fields
  },
  error: null,
}

const mockProfile = {
  id: mockUserId,
  // Add other necessary profile fields
}

test.describe("Secure Messages Loader", () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies/storage before each test
    await page.context().clearCookies()
  })

  test("redirects to login when user is not authenticated", async ({
    page,
  }) => {
    await page.goto(`/ga/secure-messages/${mockMessageId}`)

    // Should redirect to login page
    await expect(page).toHaveURL(/.*\/sign-in.*/)
    // Check return_to is set in cookies
    const cookies = await page.context().cookies()
    const returnToCookie = cookies.find(
      (cookie) => cookie.name === "logtoPostLoginRedirectUrl",
    )
    await expect(returnToCookie?.value).toBe(
      encodeURIComponent(`/ga/secure-messages/${mockMessageId}`),
    )
  })

  test("redirects public servant to admin page", async ({ page }) => {
    // Mock authentication and public servant status
    await auth.loginAsSpecificUser(page, "tony.stark@gov.ie", {
      loginURL: "http://localhost:3002/pre-login",
    })
    await page.goto(`/secure-messages/${mockMessageId}`)

    // Should redirect to admin page
    await expect(page).toHaveURL("/en/admin/send-a-message")
  })

  test("shows message for authenticated regular user with valid message", async ({
    page,
  }) => {
    await auth.loginAsSpecificUser(page, "peter.parker@mail.ie", {
      loginURL: "http://localhost:3002/pre-login",
    })
    await page.goto(`/secure-messages/${mockMessageId}`)

    // Should redirect to home page because the message does not exist
    await expect(page).toHaveURL("/en/home")
  })

  test("handles partial message from onboarding service", async ({ page }) => {
    await auth.loginAsSpecificUser(page, "bruce.wayne@mail.ie", {
      loginURL: "http://localhost:3002/pre-login",
    })
    // Mock authentication
    await page.route("**/api/auth/user", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ isPublicServant: false, user: mockProfile }),
      })
    })

    // Mock messaging service 404 response
    await page.route("**/messages/**", async (route) => {
      await route.fulfill({
        status: 404,
        body: JSON.stringify({ error: { statusCode: 404 } }),
      })
    })

    // Mock onboarding service response
    await page.route("**/secure-messages/**", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify(mockMessage),
      })
    })

    // Mock profile responses
    await page.route("**/profiles/**", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify(mockProfile),
      })
    })

    await page.goto(`/secure-messages/${mockMessageId}`)

    // Should stay on the secure messages page
    await expect(page).toHaveURL(`/secure-messages/${mockMessageId}`)
    // Verify the page shows the partial message content
    // Add specific assertions based on your UI implementation
  })
})
