import type { Browser, BrowserContext } from "@playwright/test"

/**
 * Creates a browser context with video recording enabled
 * This ensures all tests record videos when they fail
 */
export async function createContextWithVideo(
  browser: Browser,
): Promise<BrowserContext> {
  return await browser.newContext({
    recordVideo: {
      dir: "e2e/test-results",
    },
  })
}

/**
 * Creates a page from a browser with video recording enabled
 * This is a convenience function for tests that need a quick page setup
 */
export async function createPageWithVideo(browser: Browser) {
  const context = await createContextWithVideo(browser)
  return await context.newPage()
}
