import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

// Mock both shells with lightweight sentinels so this test stays focused on
// the dispatch logic, not on the shells' own (heavily-tested) internals.
vi.mock("@/components/client-shell", () => ({
  ClientShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid='messaging-admin-shell'>{children}</div>
  ),
}))

vi.mock("@/components/profile-admin/client-shell", () => ({
  ClientShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid='profile-admin-shell'>{children}</div>
  ),
}))

import { AuthenticatedShellDispatcher } from "@/components/authenticated-shell-dispatcher"

/**
 * `AuthenticatedShellDispatcher` reads `window.location.hostname` inside a
 * `useEffect` to decide which shell to render. RTL's `render()` wraps in
 * `act()`, so effects are flushed before any assertion runs.
 */
function setHostname(hostname: string) {
  vi.stubGlobal("location", { hostname })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("AuthenticatedShellDispatcher", () => {
  it("renders the messaging-admin shell for localhost (default zone)", () => {
    setHostname("localhost")
    render(
      <AuthenticatedShellDispatcher>
        <span data-testid='child'>content</span>
      </AuthenticatedShellDispatcher>,
    )
    expect(screen.getByTestId("messaging-admin-shell")).toBeInTheDocument()
    expect(screen.queryByTestId("profile-admin-shell")).not.toBeInTheDocument()
    expect(screen.getByTestId("child")).toBeInTheDocument()
  })

  it("renders the messaging-admin shell for messaging-admin.services.gov.ie", () => {
    setHostname("messaging-admin.services.gov.ie")
    render(
      <AuthenticatedShellDispatcher>
        <span data-testid='child'>content</span>
      </AuthenticatedShellDispatcher>,
    )
    expect(screen.getByTestId("messaging-admin-shell")).toBeInTheDocument()
    expect(screen.queryByTestId("profile-admin-shell")).not.toBeInTheDocument()
  })

  it("renders the profile-admin shell for profile-admin.dev.services.gov.ie", () => {
    setHostname("profile-admin.dev.services.gov.ie")
    render(
      <AuthenticatedShellDispatcher>
        <span data-testid='child'>content</span>
      </AuthenticatedShellDispatcher>,
    )
    expect(screen.getByTestId("profile-admin-shell")).toBeInTheDocument()
    expect(
      screen.queryByTestId("messaging-admin-shell"),
    ).not.toBeInTheDocument()
    expect(screen.getByTestId("child")).toBeInTheDocument()
  })

  it("renders the profile-admin shell for profile-admin.services.gov.ie (prod)", () => {
    setHostname("profile-admin.services.gov.ie")
    render(
      <AuthenticatedShellDispatcher>
        <span data-testid='child'>content</span>
      </AuthenticatedShellDispatcher>,
    )
    expect(screen.getByTestId("profile-admin-shell")).toBeInTheDocument()
    expect(
      screen.queryByTestId("messaging-admin-shell"),
    ).not.toBeInTheDocument()
  })
})
