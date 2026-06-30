import path from "node:path"
import { defineConfig, devices } from "@playwright/test"

const baseURL =
  process.env.BASE_URL?.trim() || "http://messaging.local.test:4001"

export default defineConfig({
  testDir: path.join(__dirname, "e2e/demo"),
  timeout: 300_000,
  retries: 0,
  workers: 1,
  outputDir: "demo-videos/raw",
  reporter: [["list"]],
  use: {
    baseURL,
    video: "on",
    screenshot: "off",
    trace: "off",
    actionTimeout: 30_000,
    navigationTimeout: 120_000,
    launchOptions: {
      slowMo: 400,
    },
    ...devices["Desktop Chrome"],
  },
})
