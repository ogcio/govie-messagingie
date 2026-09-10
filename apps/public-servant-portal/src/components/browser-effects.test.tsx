import { render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import FrontendObservability from "./frontend-observability"
import { HtmlLangScript } from "./html-lang-script"
import { LocaleLandingRedirect } from "./locale-landing-redirect"

const { env, instrumentFaro, localeBootstrapScript, replace } = vi.hoisted(
  () => ({
    env: {
      NEXT_PUBLIC_FARO_URL: undefined as string | undefined,
      NEXT_PUBLIC_FARO_SERVICE_NAME: "portal",
      NEXT_PUBLIC_FARO_PROPAGATE_TRACE_HEADER: ["traceparent"],
      NEXT_PUBLIC_FARO_SERVICE_NAMESPACE: "messaging",
      NEXT_PUBLIC_VERSION: "1.2.3",
    },
    instrumentFaro: vi.fn(() => ({})),
    localeBootstrapScript: vi.fn(
      (locale: string) => `window.locale="${locale}"`,
    ),
    replace: vi.fn(),
  }),
)

vi.mock("@/env/env.client", () => ({ env }))
vi.mock("@ogcio/o11y-sdk-react", () => ({ instrumentFaro }))
vi.mock("@/util/locale-cookie", () => ({ localeBootstrapScript }))
vi.mock("@/util/zone", () => ({
  getZoneFromHostname: (hostname: string) =>
    hostname.startsWith("profile-admin") ? "profile-admin" : "messaging-admin",
  ZONE_DEFAULT_PATH: {
    "messaging-admin": "send-a-message",
    "profile-admin": "service-users",
  },
}))

describe("browser effect components", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    env.NEXT_PUBLIC_FARO_URL = undefined
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("renders no UI and skips Faro when no collector is configured", () => {
    const { container } = render(<FrontendObservability />)
    expect(container).toBeEmptyDOMElement()
    expect(instrumentFaro).not.toHaveBeenCalled()
  })

  it("instruments Faro once when configured", async () => {
    env.NEXT_PUBLIC_FARO_URL = "https://faro.example"
    const { rerender } = render(<FrontendObservability />)
    rerender(<FrontendObservability />)
    await waitFor(() => expect(instrumentFaro).toHaveBeenCalledOnce())
    expect(instrumentFaro).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceName: "portal",
        collectorUrl: "https://faro.example",
        collectorMode: "batch",
      }),
    )
  })

  it("embeds the locale bootstrap script", () => {
    const { container } = render(<HtmlLangScript locale='ga' />)
    expect(localeBootstrapScript).toHaveBeenCalledWith("ga")
    expect(container.querySelector("script")?.innerHTML).toBe(
      'window.locale="ga"',
    )
  })

  it("redirects to the zone landing page", () => {
    vi.stubGlobal("location", {
      hostname: "profile-admin.dev.services.gov.ie",
      replace,
    })
    render(<LocaleLandingRedirect locale='ga' />)
    expect(replace).toHaveBeenCalledWith("/ga/service-users")
  })
})
