import path from "node:path"
import { defineConfig, devices } from "@playwright/test"

// Use environment URL or fallback to local dev
const baseURL = process.env.BASE_URL || "http://localhost:3002"

// Reference: https://playwright.dev/docs/test-configuration
export default defineConfig({
  globalTimeout: 3480000, //58 minutes
  expect: {
    timeout: 25000,
  },
  // Timeout per test
  timeout: 180 * 1000,
  // Test directory
  testDir: path.join(__dirname, "e2e"),
  // If a test fails, retry it additional 2 times
  retries: 2,
  // Artifacts folder where screenshots, videos, and traces are stored.
  outputDir: "test-results/",
  //junit test results
  reporter: [
    ["junit", { outputFile: "e2e/test-results/results.xml" }], // JUnit report
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],

  // Run your local dev server before starting the tests:
  // https://playwright.dev/docs/test-advanced#launching-a-development-web-server-during-the-tests
  webServer: {
    command: "npm run dev",
    url: baseURL,
    timeout: 180 * 1000,
    reuseExistingServer: !process.env.CI,
  },

  use: {
    // Screenshot on test failure
    screenshot: "only-on-failure",
    // Record video on failure
    video: "retain-on-failure",
    // Use baseURL so to make navigations relative.
    // More information: https://playwright.dev/docs/api/class-testoptions#test-options-base-url
    baseURL,

    // Retry a test if its failing with enabled tracing. This allows you to analyze the DOM, console logs, network traffic etc.
    // More information: https://playwright.dev/docs/trace-viewer
    trace: "retain-on-failure",
  },

  projects: [
    {
      name: "Desktop Chrome",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    // {
    //   name: 'Desktop Firefox',
    //   use: {
    //     ...devices['Desktop Firefox'],
    //   },
    // },
    // {
    //   name: 'Desktop Safari',
    //   use: {
    //     ...devices['Desktop Safari'],
    //   },
    // },
    // Test against mobile viewports.
    // {
    //   name: "Mobile Chrome",
    //   use: {
    //     ...devices["Pixel 5"],
    //   },
    // },
    // {
    //   name: "Mobile Safari",
    //   use: devices["iPhone 12"],
    // },
  ],
})
