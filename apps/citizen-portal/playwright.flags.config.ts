import path from "node:path"
import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright config for the disabled-topology e2e run (AB#39580).
 *
 * The build-time `NEXT_PUBLIC_ENABLE_*` flags are baked at dev-server
 * start, so this config boots its OWN `next dev` on a dedicated port with
 * the "MessagingIE + Profile, no Dashboard" topology and runs only
 * `standalone-topology.spec.ts` against it. These flags are app-only —
 * the SAG / API backends are unaffected — so it reuses the same local-auth
 * stack as `test:e2e:local:full` (point `E2E_AUTH_URL` at it).
 *
 * Run via `pnpm test:e2e:flags:local` (sets `CITIZEN_PORTAL_FLAGS_E2E`,
 * which un-skips the spec).
 */
const PORT = process.env.FLAGS_PORT || "4011"
const baseURL = process.env.FLAGS_BASE_URL || `http://localhost:${PORT}`

export default defineConfig({
  globalTimeout: 1_800_000,
  expect: { timeout: 25_000 },
  timeout: 180 * 1000,
  testDir: path.join(__dirname, "e2e", "feature-flags"),
  testMatch: /standalone-topology\.spec\.ts/,
  retries: 1,
  outputDir: "test-results-flags/",
  reporter: [["list"]],

  // App-only topology flags injected into the dev server. The standalone
  // spec asserts the "no Dashboard" experience this produces.
  webServer: {
    command: `PORT=${PORT} next dev`,
    url: baseURL,
    timeout: 180 * 1000,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_ENABLE_DASHBOARD: "false",
      NEXT_PUBLIC_ENABLE_MESSAGING: "true",
      NEXT_PUBLIC_ENABLE_JOURNEY_INTEGRATION: "true",
      NEXT_PUBLIC_ENABLE_PAYMENTS_INTEGRATION: "true",
      NEXT_PUBLIC_ENABLE_FORMS_INTEGRATION: "false",
    },
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
      use: { ...devices["Desktop Chrome"] },
    },
  ],
})
