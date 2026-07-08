import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Topology flag drives whether the recent-messages widget is part of the
// dashboard landing (AB#39580): a deployment without MessagingIE must not
// render a messages preview that 404s / implies messaging is present.
const flagState = vi.hoisted(() => ({ messages: true }))
vi.mock("@/lib/feature-config", () => ({
  isZoneEnabled: (zone: "messages" | "profile" | "dashboard") =>
    zone === "messages" ? flagState.messages : true,
}))

vi.mock("@ogcio/sag-client/react", () => ({
  useAuth: () => ({ user: { sub: "user-1" }, loading: false }),
}))

vi.mock("@/hooks/use-public-name", () => ({
  usePublicName: () => "Jane",
}))

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}))

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

// Static asset import — vite can't resolve a real PNG under vitest.
vi.mock("@/public/govie.png", () => ({ default: "govie.png" }))

vi.mock("@/components/layout/containers", () => ({
  TwoColumnLayout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

vi.mock("@/components/navigation/bold-link", () => ({
  BoldLink: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}))

vi.mock("@ogcio/design-system-react", () => ({
  Heading: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  Paragraph: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// The widget itself is exercised by its own suite; here we only need a
// recognisable sentinel to assert presence/absence.
vi.mock("@/components/dashboard/my-messages", () => ({
  MyMessages: () => <div data-testid='my-messages' />,
}))

import { MyDashboard } from "@/components/dashboard/my-dashboard"

describe("MyDashboard", () => {
  beforeEach(() => {
    flagState.messages = true
  })

  it("renders the recent-messages widget when messaging is enabled", () => {
    render(<MyDashboard />)
    expect(screen.getByTestId("my-messages")).toBeInTheDocument()
  })

  it("omits the recent-messages widget when messaging is disabled", () => {
    flagState.messages = false
    render(<MyDashboard />)
    expect(screen.queryByTestId("my-messages")).not.toBeInTheDocument()
    // The rest of the landing (welcome heading + help card) still renders.
    expect(screen.getByText("dashboard.welcome")).toBeInTheDocument()
    expect(screen.getByText("dashboard.help.title")).toBeInTheDocument()
  })
})
