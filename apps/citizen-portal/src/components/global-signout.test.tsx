import { act, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const POST_REDIRECT_URI = "https://journey.uat.services.gov.ie/journey/abc-123"

const { searchParamsHolder } = vi.hoisted(() => ({
  searchParamsHolder: { value: new URLSearchParams() },
}))

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsHolder.value,
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock("@citizen-portal/shared", () => ({
  getEnv: () => ({
    hosts: {
      messages: "https://messages.uat.test",
      profile: "https://profile.uat.test",
      dashboard: "https://dashboard.uat.test",
    },
    sagUrl: "https://sag.uat.test",
    sagAppName: "profile",
  }),
}))

vi.mock("@/env/env.client", () => ({
  env: {
    NEXT_PUBLIC_BASE_URL: "https://citizen.uat.test",
    NEXT_PUBLIC_SAG_URL: "https://sag.uat.test",
    NEXT_PUBLIC_DASHBOARD_ADMIN_URL: "https://dashboard-admin.uat.test",
    NEXT_PUBLIC_PAYMENTS_URL: "https://payments.uat.test",
    NEXT_PUBLIC_JOURNEY_URL: "https://journey.uat.test",
    NEXT_PUBLIC_PROFILE_ADMIN_URL: "https://profile-admin.uat.test",
    NEXT_PUBLIC_MESSAGING_ADMIN_URL: "https://messaging-admin.uat.test",
    NEXT_PUBLIC_MYGOVID_END_SESSION_URL: undefined,
  },
}))

import { GlobalSignout } from "./global-signout"

let hrefValue = ""

beforeEach(() => {
  hrefValue = ""
  vi.useFakeTimers()
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      get href() {
        return hrefValue
      },
      set href(value: string) {
        hrefValue = value
      },
      hostname: "citizen.uat.test",
    },
  })
})

afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe("GlobalSignout (sagSignout flow)", () => {
  // After the iframe fan-out and the minimum delay, a sagSignout must land
  // the browser on the postRedirectUri it was given.
  it("redirects to postRedirectUri once signout completes", () => {
    searchParamsHolder.value = new URLSearchParams({
      postRedirectUri: POST_REDIRECT_URI,
      sagSignout: "true",
    })

    render(<GlobalSignout />)

    // Advance past both the iframe-load fallback timeout (20s) and the
    // minimum display delay (3s) so the completion effect fires.
    act(() => {
      vi.advanceTimersByTime(20_000)
    })

    expect(hrefValue).toBe(POST_REDIRECT_URI)
  })
})
