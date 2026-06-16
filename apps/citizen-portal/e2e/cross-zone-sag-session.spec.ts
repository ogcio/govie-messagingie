/**
 * Cross-zone SAG session-cookie e2e (AB#38246)
 *
 * STATUS
 * ------
 * The SAG `SESSION_COOKIE_DOMAIN` server-side change has LANDED on
 * `@ogcio/secure-api-gateway` feat/AB#38246 and is verified at the wire
 * level by:
 *   - `apps/secure-api-gateway/tests/functional/cookie-domain.test.ts`
 *     (5 tests asserting raw Set-Cookie / clearCookie headers)
 *   - `apps/secure-api-gateway/tests/unit/cookie-domain.test.ts`
 *     (12 tests over the helper branches)
 *   - `apps/secure-api-gateway/tests/unit/auth-cookies.test.ts`
 *     (16 tests including 3 SESSION_COOKIE_DOMAIN regression cases)
 *
 * Together they cover the red→green cycle deterministically:
 *   RED   — `SESSION_COOKIE_DOMAIN` unset → Set-Cookie has no `Domain=`
 *          → cookie is host-only, does NOT travel between subdomains
 *   GREEN — `SESSION_COOKIE_DOMAIN=.dev.services.gov.ie` (or per env)
 *          → Set-Cookie carries `Domain=.dev.services.gov.ie`
 *          → cookie is parent-scoped, travels between the three zones
 *
 * Browser cookie traversal on top of those headers is governed by
 * RFC 6265 and behaves identically across browsers, so the headers ARE
 * the verification.
 *
 * THIS SPEC
 * ---------
 * This Playwright spec is the BROWSER-LEVEL demonstrator on top of the
 * wire-level proof above. It is kept tagged
 * `@cross-zone @blocker-AB#38246-sag` and stays SKIPPED until the
 * `apps/citizen-portal/docker-compose.yaml` harness can stand up the
 * three nginx-served zones plus a SAG container on `*.local.test:8080`
 * (Phase 5 cutover). Activating it then is a single `test.describe` →
 * `test.describe` change.
 *
 * Until then, RUN THE SAG TESTS for verification:
 *   cd @ogcio/secure-api-gateway
 *   pnpm --filter @ogcio/secure-api-gateway exec vitest run \
 *     tests/functional/cookie-domain.test.ts \
 *     tests/unit/cookie-domain.test.ts \
 *     tests/unit/auth-cookies.test.ts
 *
 * Tags: @cross-zone @blocker-AB#38246-sag
 *   Run only this test:  pnpm exec playwright test --grep '@blocker-AB#38246-sag'
 *   Skip in CI smoke:    pnpm exec playwright test --grep-invert '@blocker-AB#38246-sag'
 */
import { expect, test } from "@playwright/test"

const HOSTS = {
  messages: process.env.MESSAGING_HOST ?? "http://messaging.local.test:8080",
  profile: process.env.PROFILE_HOST ?? "http://profile.local.test:8080",
  dashboard: process.env.DASHBOARD_HOST ?? "http://dashboard.local.test:8080",
}

// Opt-in by exporting `RUN_CROSS_ZONE_E2E=1` together with the local
// auth chain (`docker-compose.local-auth.yaml`). Without that env, the
// suite is per-test-skipped so the smoke job (`test:e2e:local:smoke`),
// which only brings up the bare citizen-portal nginx, doesn't try to
// drive an auth flow it can't complete. The `test:e2e:local:full`
// pnpm script exports the env automatically.
//
// Why a per-test `test.skip()` rather than `describe.skip()`: the
// describe-skip blocks vitest's traceability matrix from listing this
// spec at all, which made the test invisible during the long
// "blocked-on-SAG" period. The per-test skip surfaces the spec in
// reports as "skipped: reason" so the gating context is obvious.
test.describe("@cross-zone @blocker-AB#38246-sag SAG session survives subdomain navigation", () => {
  test.skip(
    !process.env.RUN_CROSS_ZONE_E2E,
    "Set RUN_CROSS_ZONE_E2E=1 with the local-auth docker compose stack up to run this spec. " +
      "See docs/testing.md → 'Full local e2e (test:e2e:local:full)'.",
  )

  test("authenticated user on messaging.* stays authenticated on profile.*", async ({
    page,
    context,
  }) => {
    // The auth helper TODO is intentionally absent — when the docker-
    // compose harness exposes a mock IdP, this test becomes a one-liner
    // sign-in followed by the cookie-traversal assertions below. Keeping
    // the assertions stable means activating this test only requires
    // wiring the sign-in step, not rewriting the verification.
    await page.goto(`${HOSTS.messages}/en/messages`)

    const cookiesBeforeJump = await context.cookies()
    const sagCookieBefore = cookiesBeforeJump.find((c) =>
      /sag|session|logto/i.test(c.name),
    )
    expect(
      sagCookieBefore,
      "SAG session cookie not set after auth",
    ).toBeDefined()

    // Critical assertion — cookie must be parent-domain scoped. This is
    // the single failure mode the Phase 2 cross-zone work depends on
    // getting fixed in the secure-api-gateway via SESSION_COOKIE_DOMAIN.
    expect(
      sagCookieBefore?.domain,
      "SAG cookie domain must be parent (.<env>.services.gov.ie / .local.test) for cross-zone session sharing — see secure-api-gateway SESSION_COOKIE_DOMAIN",
    ).toMatch(
      /^\.(local\.test|dev\.services\.gov\.ie|uat\.services\.gov\.ie|services\.gov\.ie)$/,
    )

    await page.goto(`${HOSTS.profile}/en/my-profile`)

    await expect(page).not.toHaveURL(/sign-in|login|callback/, {
      timeout: 5000,
    })
    const cookiesAfterJump = await context.cookies()
    const sagCookieAfter = cookiesAfterJump.find(
      (c) => c.name === sagCookieBefore?.name,
    )
    expect(
      sagCookieAfter,
      "SAG cookie did not propagate to profile.* subdomain — server-side cookie domain is too narrow",
    ).toBeDefined()
  })
})
