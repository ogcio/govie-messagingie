/**
 * Browser-based test for Next.js pages
 *
 * These tests run in a real browser using Playwright.
 * Use this approach for testing full pages with server components.
 *
 * IMPORTANT: The dev server must be running for these tests to work.
 *
 * To run browser tests:
 * 1. Start the dev server: pnpm dev (in one terminal)
 * 2. Run browser tests: pnpm test:browser (in another terminal)
 *
 * Or run a specific browser test file:
 * pnpm vitest --browser test/pages/messages-page.browser.test.ts
 */

import { expect, test } from "vitest"

test("messages page loads and displays content", async ({
  page,
}: {
  page: any
}) => {
  // Navigate to the messages page
  await page.goto("http://localhost:3000/en/messages")

  // Wait for the page to load
  await page.waitForLoadState("networkidle")

  // Check that the heading is visible
  const heading = page.getByRole("heading", { level: 1 })
  await expect(heading).toBeVisible()

  // Check that messages are displayed (if any)
  const list = page.getByRole("list")
  await expect(list).toBeVisible()
})

test("messages page handles navigation", async ({ page }: { page: any }) => {
  await page.goto("http://localhost:3000/en/messages")
  await page.waitForLoadState("networkidle")

  // Check if there are message links
  const links = page.getByRole("link")
  const linkCount = await links.count()

  if (linkCount > 0) {
    // Click the first message link
    await links.first().click()

    // Wait for navigation
    await page.waitForLoadState("networkidle")

    // Verify we're on a message detail page
    // Adjust the selector based on your actual page structure
    const url = page.url()
    expect(url).toMatch(/\/messages\/\d+/)
  }
})
