import { render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import GlobalSignoutRedirect from "./global-signout/page"
import RootPage from "./page"
import WrongAccountErrorRedirect from "./wrong-account-error/page"
import WrongLoginMethodRedirect from "./wrong-login-method-error/page"

const { locationReplace, searchParamsHolder } = vi.hoisted(() => ({
  locationReplace: vi.fn(),
  searchParamsHolder: { value: new URLSearchParams() },
}))

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsHolder.value,
}))

vi.mock("@/hooks/use-locale-preference", () => ({
  useLocalePreference: () => ({ locale: "ga", isReady: true }),
}))

vi.mock("@/lib/zone-config", () => ({
  ZONE_CONFIG: {
    messages: { rootPath: "/messages" },
    profile: { rootPath: "/my-profile" },
  },
}))

vi.mock("@/util/get-zone-from-origin", () => ({
  getZoneFromOrigin: () => "messages",
}))

vi.mock("@/util/force-consent", () => ({
  withForceConsent: (path: string) => `${path}?forceConsent=true`,
}))

describe("no-locale redirect pages", () => {
  beforeEach(() => {
    locationReplace.mockReset()
    searchParamsHolder.value = new URLSearchParams()
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        origin: "https://messages.test",
        replace: locationReplace,
      },
    })
  })

  it("redirects the root to the locale-specific zone", async () => {
    render(<RootPage />)

    await waitFor(() =>
      expect(locationReplace).toHaveBeenCalledWith(
        "/ga/messages?forceConsent=true",
      ),
    )
  })

  it("preserves global-signout parameters and maps the legacy redirect key", async () => {
    searchParamsHolder.value = new URLSearchParams({
      postRedirectUrl: "https://service.test/return",
      role: "citizen",
    })

    render(<GlobalSignoutRedirect />)

    await waitFor(() => expect(locationReplace).toHaveBeenCalledOnce())
    const target = new URL(locationReplace.mock.calls[0][0])
    expect(target.pathname).toBe("/ga/global-signout")
    expect(target.searchParams.get("postRedirectUri")).toBe(
      "https://service.test/return",
    )
    expect(target.searchParams.get("role")).toBe("citizen")
  })

  it.each([
    ["wrong-account-error", WrongAccountErrorRedirect],
    ["wrong-login-method-error", WrongLoginMethodRedirect],
  ])("redirects to the localized %s route", async (route, Page) => {
    searchParamsHolder.value = new URLSearchParams({
      returnUrl: "https://service.test/return",
    })

    render(<Page />)

    await waitFor(() => expect(locationReplace).toHaveBeenCalledOnce())
    const target = new URL(locationReplace.mock.calls[0][0])
    expect(target.pathname).toBe(`/ga/${route}`)
    expect(target.searchParams.get("returnUrl")).toBe(
      "https://service.test/return",
    )
  })
})
