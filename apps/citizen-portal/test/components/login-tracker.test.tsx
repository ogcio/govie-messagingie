import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const trackEvent = vi.hoisted(() => vi.fn())

vi.mock("@ogcio/nextjs-analytics", () => ({
  useAnalytics: () => ({ trackEvent }),
}))

import { LoginTracker } from "@/components/analytics/login-tracker"

describe("LoginTracker", () => {
  beforeEach(() => {
    trackEvent.mockClear()
    sessionStorage.clear()
  })

  it("fires user-login once on mount", () => {
    render(<LoginTracker />)
    expect(trackEvent).toHaveBeenCalledTimes(1)
    expect(trackEvent).toHaveBeenCalledWith({
      event: {
        name: "user-login",
        category: "User",
        action: "Login",
      },
    })
  })

  it("does not fire again within the same session", () => {
    sessionStorage.setItem("citizen_portal_login_tracked", "1")
    render(<LoginTracker />)
    expect(trackEvent).not.toHaveBeenCalled()
  })
})
