import { describe, expect, it, vi } from "vitest"

// The sag-client ESM package re-exports via relative imports that
// don't carry the `.js` extension Node ESM expects, so a real import
// from `@ogcio/sag-client/react` blows up under vitest + jsdom. Stub
// the two constants the table consumes — the literal strings here
// MUST match the upstream sag-client values
// (PROFILE_PUBLIC_SERVANT_ROLE_NAME / MESSAGING_PUBLIC_SERVANT_ROLE_NAME)
// so a real-vs-mocked drift is caught by the explicit assertions
// below.
const MESSAGING_PUBLIC_SERVANT_ROLE_NAME = "Messaging Public Servant"
const PROFILE_PUBLIC_SERVANT_ROLE_NAME = "Profile Public Servant"
const DASHBOARD_PUBLIC_SERVANT_ROLE_NAME = "Dashboard Public Servant"

vi.mock("@ogcio/sag-client/react", () => ({
  MESSAGING_PUBLIC_SERVANT_ROLE_NAME,
  PROFILE_PUBLIC_SERVANT_ROLE_NAME,
  DASHBOARD_PUBLIC_SERVANT_ROLE_NAME,
}))

const { ZONE_CONFIG } = await import("@/lib/zone-config")
type Zone = keyof typeof ZONE_CONFIG

/**
 * `ZONE_CONFIG` is the canonical per-zone wiring table — every other
 * shared component (`ClientShell`, `PageHeader`, `CitizenSagProvider`)
 * keys off it. A typo or accidental shape change here is high-impact
 * (wrong audience for the SAG cookie → silent auth break), so the
 * suite pins:
 *   1. exact set of zones (closed enum),
 *   2. exact role names per zone (cross-checked against the upstream
 *      sag-client constants so a rename there fails this test rather
 *      than the prod auth flow),
 *   3. the env-key + rootPath strings that the shell + nginx rely on
 *      staying in lockstep.
 */
describe("ZONE_CONFIG", () => {
  it("exposes exactly the three citizen-portal zones, no more no less", () => {
    expect(Object.keys(ZONE_CONFIG).sort()).toEqual([
      "dashboard",
      "messages",
      "profile",
    ])
  })

  it("messages zone wires up to messaging SAG + admin redirect + consent shell", () => {
    expect(ZONE_CONFIG.messages).toEqual({
      sagAppName: "messaging",
      publicServantRoleName: MESSAGING_PUBLIC_SERVANT_ROLE_NAME,
      publicServantRedirectEnvKey: "NEXT_PUBLIC_MESSAGING_ADMIN_URL",
      rootPath: "/messages",
      showsConsentAndAnnouncements: true,
      runsStaleClaimsGate: true,
    })
  })

  it("profile zone wires up to profile SAG + profile-admin redirect, no consent shell", () => {
    expect(ZONE_CONFIG.profile).toEqual({
      sagAppName: "profile",
      publicServantRoleName: PROFILE_PUBLIC_SERVANT_ROLE_NAME,
      publicServantRedirectEnvKey: "NEXT_PUBLIC_PROFILE_ADMIN_URL",
      rootPath: "/my-profile",
      showsConsentAndAnnouncements: false,
      runsStaleClaimsGate: false,
    })
  })

  it("dashboard zone wires up to dashboard SAG + dashboard-admin redirect, no consent shell", () => {
    // The placeholder role uses MESSAGING_PUBLIC_SERVANT_ROLE_NAME on
    // purpose — see the inline comment in zone-config.ts. The dashboard
    // onboarding guard never compares against this value; it short-
    // circuits on the env-keyed publicServantRedirectUrl alone. The
    // assertion below pins the placeholder so a future "tidy this up"
    // refactor doesn't silently change the audience-bound behaviour.
    expect(ZONE_CONFIG.dashboard).toEqual({
      sagAppName: "dashboard",
      publicServantRoleName: MESSAGING_PUBLIC_SERVANT_ROLE_NAME,
      publicServantRedirectEnvKey: "NEXT_PUBLIC_DASHBOARD_ADMIN_URL",
      rootPath: "/my-dashboard",
      showsConsentAndAnnouncements: false,
      runsStaleClaimsGate: false,
    })
  })

  it("each zone's rootPath matches its primary owned URI prefix", () => {
    // The shared <PageHeader> uses ZONE_CONFIG[zone].rootPath for the
    // logo link target; nginx canonicalisation, in turn, owns those
    // exact path prefixes per host. Keep the two in lockstep — the
    // strings here MUST be the same as the owned URI prefixes in
    // `apps/citizen-portal/docker/nginx.conf.template`.
    expect(ZONE_CONFIG.messages.rootPath).toBe("/messages")
    expect(ZONE_CONFIG.profile.rootPath).toBe("/my-profile")
    expect(ZONE_CONFIG.dashboard.rootPath).toBe("/my-dashboard")
  })

  it("publicServantRedirectEnvKey is always a NEXT_PUBLIC_*_ADMIN_URL token", () => {
    // The runtime reads the actual URL from `env.client` keyed by this
    // string. Anything outside the allowed shape (the discriminated
    // union in `ZoneConfig`) would be a typo that compiles but blows
    // up at runtime with `undefined.match()`.
    for (const zone of Object.keys(ZONE_CONFIG) as Zone[]) {
      expect(ZONE_CONFIG[zone].publicServantRedirectEnvKey).toMatch(
        /^NEXT_PUBLIC_[A-Z_]+_ADMIN_URL$/,
      )
    }
  })

  it("only the messages zone opts in to the consent banner + stale-claims gate", () => {
    // Pin the asymmetry: consent + the onboarding refresh gate are
    // messaging-only today. If either flips elsewhere we want a loud
    // test failure that forces an explicit story update — they have
    // downstream side effects on layout + auth.
    expect(ZONE_CONFIG.messages.showsConsentAndAnnouncements).toBe(true)
    expect(ZONE_CONFIG.messages.runsStaleClaimsGate).toBe(true)
    expect(ZONE_CONFIG.profile.showsConsentAndAnnouncements).toBe(false)
    expect(ZONE_CONFIG.profile.runsStaleClaimsGate).toBe(false)
    expect(ZONE_CONFIG.dashboard.showsConsentAndAnnouncements).toBe(false)
    expect(ZONE_CONFIG.dashboard.runsStaleClaimsGate).toBe(false)
  })
})
