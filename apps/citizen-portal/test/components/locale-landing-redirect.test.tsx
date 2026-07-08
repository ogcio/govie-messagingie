import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// The locale-root landing must steer to an *enabled* zone (AB#39580):
// on a deployment without dashboard, `/{locale}/` can't redirect to the
// (absent) dashboard home.
const state = vi.hoisted(() => ({
  origin: "dashboard" as "messages" | "profile" | "dashboard",
  landing: "dashboard" as "messages" | "profile" | "dashboard",
}))

vi.mock("@/util/get-zone-from-origin", () => ({
  getZoneFromOrigin: () => state.origin,
}))

vi.mock("@/lib/feature-config", () => ({
  getEnabledLandingZone: (_zone: "messages" | "profile" | "dashboard") =>
    state.landing,
}))

// ZONE_CONFIG pulls in @ogcio/sag-client/react role constants; stub them
// so the real per-zone rootPath table loads under vitest.
vi.mock("@ogcio/sag-client/react", () => ({
  MESSAGING_PUBLIC_SERVANT_ROLE_NAME: "Messaging Public Servant",
  PROFILE_PUBLIC_SERVANT_ROLE_NAME: "Profile Public Servant",
}))

vi.mock("@/util/force-consent", () => ({
  withForceConsent: (url: string) => `${url}?force-consent=1`,
}))

import { LocaleLandingRedirect } from "@/components/locale-landing-redirect"

let replaceSpy: ReturnType<typeof vi.fn>
let originalLocation: Location

beforeEach(() => {
  state.origin = "dashboard"
  state.landing = "dashboard"
  originalLocation = window.location
  replaceSpy = vi.fn()
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { replace: replaceSpy },
  })
})

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
  })
  vi.clearAllMocks()
})

describe("LocaleLandingRedirect", () => {
  it("redirects to the dashboard home when dashboard is the enabled landing", () => {
    state.origin = "dashboard"
    state.landing = "dashboard"
    render(<LocaleLandingRedirect locale='en' />)
    expect(replaceSpy).toHaveBeenCalledWith("/en/my-dashboard")
  })

  it("redirects to the messages home (with force-consent) when messages is the landing", () => {
    // e.g. dashboard host is hit but dashboard is disabled -> messages.
    state.origin = "dashboard"
    state.landing = "messages"
    render(<LocaleLandingRedirect locale='en' />)
    expect(replaceSpy).toHaveBeenCalledWith("/en/messages?force-consent=1")
  })

  it("redirects to the profile home for a profile-only deployment", () => {
    state.origin = "dashboard"
    state.landing = "profile"
    render(<LocaleLandingRedirect locale='ga' />)
    expect(replaceSpy).toHaveBeenCalledWith("/ga/my-profile")
  })
})
