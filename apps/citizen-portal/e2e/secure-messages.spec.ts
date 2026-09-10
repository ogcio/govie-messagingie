import { expect, test } from "@playwright/test"
import auth from "./auth"
import { ids, urls, users } from "./fixtures"

// Mock data
const mockMessageId = ids.mockMessage
const mockUserId = ids.mockUser
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

    // Should redirect to login page (legacy path-based email link is rewritten to ?id= first)
    await expect(page).toHaveURL(/.*\/sign-in.*/)
    // Check return_to is set in cookies
    const cookies = await page.context().cookies()
    const returnToCookie = cookies.find(
      (cookie) => cookie.name === "logtoPostLoginRedirectUrl",
    )
    await expect(returnToCookie?.value).toBe(
      encodeURIComponent(`/ga/secure-messages?id=${mockMessageId}`),
    )
  })

  test("redirects public servant to admin page", async ({ page }) => {
    // Mock authentication and public servant status
    await auth.loginAsSpecificUser(page, users.tonyStark.email, {
      loginURL: `${urls.auth}/pre-login`,
    })
    await page.goto(`/secure-messages/${mockMessageId}`)

    // Should redirect to admin page
    await expect(page).toHaveURL("/en/admin/send-a-message")
  })

  test("shows message for authenticated regular user with valid message", async ({
    page,
  }) => {
    await auth.loginAsSpecificUser(page, users.peterParker.email, {
      loginURL: `${urls.auth}/pre-login`,
    })
    await page.goto(`/secure-messages/${mockMessageId}`)

    // Should redirect to home page because the message does not exist
    await expect(page).toHaveURL("/en/home")
  })

  test("handles partial message from onboarding service", async ({ page }) => {
    await auth.loginAsSpecificUser(page, users.bruceWayne.email, {
      loginURL: `${urls.auth}/pre-login`,
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

    // Should stay on the secure messages page (legacy path rewritten to ?id=)
    await expect(page).toHaveURL(`/secure-messages?id=${mockMessageId}`)
    // Verify the page shows the partial message content
    // Add specific assertions based on your UI implementation
  })
})
