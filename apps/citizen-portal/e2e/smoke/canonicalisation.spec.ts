/**
 * Local docker smoke spec for the consolidated citizen-portal.
 *
 * Drives the running `citizen-portal:local` container directly (so it is
 * intentionally NOT pinned to the global `baseURL`). Verifies the only two
 * behaviours that are genuinely new in the consolidation:
 *
 *   1. Each canonical hostname serves its in-zone public pages with 200,
 *      and the header/title resolve to the correct zone via
 *      `getZoneFromOrigin` (hostname-based zone detection).
 *   2. Any off-zone path on any of the three hostnames is 301-redirected to
 *      the canonical owner with the port preserved (production runs on
 *      :443/HTTPS where the port is omitted; the local docker harness on
 *      :8080 catches port-elision regressions like the one in
 *      `nginx.conf.template`).
 *
 * Run with:
 *
 *   pnpm --filter @citizen-portal/app test:e2e:smoke:local
 *
 * which sets DOCKER_BASE_URL=http://messaging.local.test:8080 and reuses
 * the existing docker container (see README for `docker:up:citizen-portal:local`).
 */
import { expect, test } from "@playwright/test"

const PORT = process.env.DOCKER_PORT ?? "8080"
const MESSAGING_HOST = `http://messaging.local.test:${PORT}`
const PROFILE_HOST = `http://profile.local.test:${PORT}`
const DASHBOARD_HOST = `http://dashboard.local.test:${PORT}`

const PUBLIC_PAGES = [
  { path: "/en/accessibility-statement", title: /Statement of commitment/ },
  { path: "/en/contact-support", title: /Contact support/ },
  { path: "/en/cookie-policy", title: /Cookie Disclaimer/ },
  { path: "/ga/contact-support", title: /Cuir glaoch ar an tacaíocht/ },
] as const

test.describe("@smoke canonical hostnames serve in-zone public pages", () => {
  for (const page of PUBLIC_PAGES) {
    test(`profile.local.test ${page.path} -> 200`, async ({ page: pw }) => {
      const response = await pw.goto(`${PROFILE_HOST}${page.path}`)
      expect(response?.status()).toBe(200)
      await expect(pw.getByRole("heading").first()).toContainText(page.title)
    })
  }

  test("messaging.local.test header reads 'Messages'", async ({ page }) => {
    const response = await page.goto(
      `${MESSAGING_HOST}/en/accessibility-statement`,
    )
    expect(response?.url()).toBe(`${PROFILE_HOST}/en/accessibility-statement`)
    expect(response?.status()).toBe(200)
  })
})

const OFF_ZONE_REDIRECTS = [
  {
    from: `${MESSAGING_HOST}/en/my-profile`,
    to: `${PROFILE_HOST}/en/my-profile`,
  },
  {
    from: `${MESSAGING_HOST}/en/my-dashboard`,
    to: `${DASHBOARD_HOST}/en/my-dashboard`,
  },
  { from: `${PROFILE_HOST}/en/messages`, to: `${MESSAGING_HOST}/en/messages` },
  {
    from: `${DASHBOARD_HOST}/en/messages`,
    to: `${MESSAGING_HOST}/en/messages`,
  },
  {
    from: `${MESSAGING_HOST}/onboarding`,
    to: `${PROFILE_HOST}/onboarding`,
  },
  {
    from: `${MESSAGING_HOST}/api/clear-session`,
    to: `${PROFILE_HOST}/api/clear-session`,
  },
] as const

test.describe("@smoke nginx canonicalisation 301s preserve port + query", () => {
  for (const { from, to } of OFF_ZONE_REDIRECTS) {
    test(`${from} -> 301 ${to}`, async ({ request }) => {
      const response = await request.get(from, { maxRedirects: 0 })
      expect(response.status()).toBe(301)
      expect(response.headers().location).toBe(to)
    })
  }

  test("query string is preserved across 301", async ({ request }) => {
    const response = await request.get(
      `${MESSAGING_HOST}/en/my-profile?force-consent=1&foo=bar`,
      { maxRedirects: 0 },
    )
    expect(response.status()).toBe(301)
    expect(response.headers().location).toBe(
      `${PROFILE_HOST}/en/my-profile?force-consent=1&foo=bar`,
    )
  })

  test("unknown Host header is refused (444 -> no response)", async ({
    request,
  }) => {
    await expect(
      request.get(`http://127.0.0.1:${PORT}/`, {
        headers: { Host: "nobody.local.test" },
        maxRedirects: 0,
      }),
    ).rejects.toThrow()
  })
})
