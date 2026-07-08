import { beforeEach, describe, expect, it, vi } from "vitest"

// Cross-block sign-out fan-out is gated per integration (AB#39580): a
// deployment that ships without Payments / Journey-Builder must not fan
// a sign-out iframe out to that origin (which both references the absent
// block and would hang on an unreachable host).
const flagState = vi.hoisted(() => ({ journey: true, payments: true }))
vi.mock("@/lib/feature-config", () => ({
  isJourneyIntegrationEnabled: () => flagState.journey,
  isPaymentsIntegrationEnabled: () => flagState.payments,
}))

vi.mock("@citizen-portal/shared", () => ({
  getEnv: () => ({ sagUrl: "http://sag.test", sagAppName: "messaging" }),
}))

const envHolder = vi.hoisted(() => ({
  value: {
    NEXT_PUBLIC_MYGOVID_END_SESSION_URL: undefined as string | undefined,
    NEXT_PUBLIC_PAYMENTS_URL: "http://payments.test",
    NEXT_PUBLIC_JOURNEY_URL: "http://journey.test",
    NEXT_PUBLIC_DASHBOARD_ADMIN_URL: "http://dashboard-admin.test",
    NEXT_PUBLIC_PROFILE_ADMIN_URL: "http://profile-admin.test",
    NEXT_PUBLIC_MESSAGING_ADMIN_URL: "http://messaging-admin.test",
    NEXT_PUBLIC_BASE_URL: "http://messaging.test",
  },
}))
vi.mock("@/env/env.client", () => ({
  get env() {
    return envHolder.value
  },
}))

const MYGOVID_END_SESSION_URL =
  "https://nonprod-account.mygovid-nonprod.ie/policy/oauth2/v2.0/logout"

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock("@ogcio/design-system-react", () => ({
  Paragraph: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  Spinner: () => <div />,
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { buildIframeUrlList } from "@/components/global-signout"

const PAYMENTS_SIGNOUT = "http://payments.test/application-signout"
const JOURNEY_SIGNOUT = "http://journey.test/application-signout"
const CLEAR_SESSION = "http://sag.test/auth/clear-session"

describe("buildIframeUrlList — cross-block fan-out gating (AB#39580)", () => {
  beforeEach(() => {
    flagState.journey = true
    flagState.payments = true
    envHolder.value.NEXT_PUBLIC_MYGOVID_END_SESSION_URL = undefined
  })

  // AB#39676: the MyGovID (Azure B2C) end-session is a cross-site logout that
  // CANNOT be cleared from a hidden iframe, so it must never appear in the
  // iframe fan-out — it is handled via a top-level navigation instead.
  it("never includes the MyGovID end-session in the iframe list", () => {
    envHolder.value.NEXT_PUBLIC_MYGOVID_END_SESSION_URL =
      MYGOVID_END_SESSION_URL
    const urls = buildIframeUrlList("citizen")
    expect(urls).not.toContain(MYGOVID_END_SESSION_URL)
  })

  it("includes Payments and Journey-Builder sign-out by default (citizen)", () => {
    const urls = buildIframeUrlList("citizen")
    expect(urls).toContain(PAYMENTS_SIGNOUT)
    expect(urls).toContain(JOURNEY_SIGNOUT)
    // The shared SAG session is always cleared.
    expect(urls).toContain(CLEAR_SESSION)
  })

  it("omits the Journey-Builder iframe when journey integration is disabled", () => {
    flagState.journey = false
    const urls = buildIframeUrlList("citizen")
    expect(urls).not.toContain(JOURNEY_SIGNOUT)
    expect(urls).toContain(PAYMENTS_SIGNOUT)
    expect(urls).toContain(CLEAR_SESSION)
  })

  it("omits the Payments iframe when payments integration is disabled", () => {
    flagState.payments = false
    const urls = buildIframeUrlList("citizen")
    expect(urls).not.toContain(PAYMENTS_SIGNOUT)
    expect(urls).toContain(JOURNEY_SIGNOUT)
    expect(urls).toContain(CLEAR_SESSION)
  })

  it("omits both when neither integration is shipped, still clears the SAG session", () => {
    flagState.journey = false
    flagState.payments = false
    const urls = buildIframeUrlList("citizen")
    expect(urls).not.toContain(PAYMENTS_SIGNOUT)
    expect(urls).not.toContain(JOURNEY_SIGNOUT)
    expect(urls).toContain(CLEAR_SESSION)
  })

  it("does not leak the gating into the public-servant admin fan-out", () => {
    // Public servants additionally clear their admin sessions; the
    // payments/journey gating is orthogonal to that branch.
    flagState.journey = false
    flagState.payments = false
    const urls = buildIframeUrlList("publicServant")
    expect(urls.some((u) => u.startsWith("http://dashboard-admin.test"))).toBe(
      true,
    )
    expect(urls).toContain(CLEAR_SESSION)
  })
})
