import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import ErrorPage from "@/app/[locale]/error"

const trackEvent = vi.hoisted(() => vi.fn())

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const labels: Record<string, string> = {
      title: "Error",
      message: "Something went wrong",
      retry: "Retry",
    }
    return labels[key] || key
  },
}))

vi.mock("@grafana/faro-web-sdk", () => ({
  faro: { api: { pushLog: vi.fn() } },
}))

vi.mock("@ogcio/nextjs-analytics", () => ({
  useAnalytics: () => ({ trackEvent }),
  AnalyticsProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

vi.mock("@/components/analytics-provider", () => ({
  AnalyticsProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

describe("ErrorPage", () => {
  it("renders the error page with heading, message, and retry button", () => {
    const resetFn = vi.fn()
    render(<ErrorPage error={new Error("Test error")} reset={resetFn} />)

    expect(screen.getByText("Error")).toBeInTheDocument()
    expect(screen.getByText("Something went wrong")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument()
  })

  it("fires system-error Matomo event on render", () => {
    const resetFn = vi.fn()
    render(<ErrorPage error={new Error("boom")} reset={resetFn} />)

    expect(trackEvent).toHaveBeenCalledWith({
      event: {
        name: "system-error",
        category: "System",
        action: "Application Error",
      },
    })
  })

  it("does not include error message in the Matomo event", () => {
    const resetFn = vi.fn()
    const errorMsg = "Some sensitive error message with PII"
    render(<ErrorPage error={new Error(errorMsg)} reset={resetFn} />)

    // Verify error message does NOT appear in any trackEvent call
    expect(trackEvent).toHaveBeenCalled()
    const calls = trackEvent.mock.calls
    calls.forEach((call) => {
      const eventStr = JSON.stringify(call)
      expect(eventStr).not.toContain(errorMsg)
    })
  })
})
