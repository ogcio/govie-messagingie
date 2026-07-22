import path from "node:path"
import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright configuration for the unified citizen-portal app.
 *
 * The unified app serves all three sections (messages, profile,
 * dashboard) from one nginx instance, so a single BASE_URL is
 * sufficient. CI scripts continue to set BASE_URL explicitly; the
 * local fallback points at the unified dev server (`pnpm dev` -> :4001).
 */
const baseURL = process.env.BASE_URL || "http://messaging.local.test:4001"

/**
 * Suppress the next-dev webServer when targeting the local docker harness
 * (BASE_URL=messaging.local.test:...). The docker container is already
 * serving every hostname, so we don't want playwright to also boot
 * `next dev` on :4001 and race with it.
 */
const isDockerHarness = /local\.test/.test(baseURL)

export default defineConfig({
  //globalTimeout: 3480000, // 58 minutes
  expect: {
    timeout: 25000,
  },
  timeout: 180 * 1000,
  testDir: path.join(__dirname, "e2e"),
  retries: 2,
  outputDir: "test-results/",
  reporter: [
    ["junit", { outputFile: "e2e/test-results/results.xml" }],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],

  webServer: isDockerHarness
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        timeout: 180 * 1000,
        reuseExistingServer: !process.env.CI,
      },

  use: {
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    baseURL,
    trace: "retain-on-failure",
  },

  projects: [
    {
      name: "Desktop Chrome",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
})
