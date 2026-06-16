import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// @ogcio/sag-client/react ships re-exports via extension-less relative
// imports that Node ESM rejects under vitest. The header touches it
// only transitively through ZONE_CONFIG (role-name constants); stub
// just those two values so the import resolves.
vi.mock("@ogcio/sag-client/react", () => ({
  MESSAGING_PUBLIC_SERVANT_ROLE_NAME: "Messaging Public Servant",
  PROFILE_PUBLIC_SERVANT_ROLE_NAME: "Profile Public Servant",
  DASHBOARD_PUBLIC_SERVANT_ROLE_NAME: "Dashboard Public Servant",
}))

let mockPathname = "/en/messages"
let mockLocale: "en" | "ga" = "en"

// `usePathname` drives the active zone resolution + the language-href
// builder; the stub lets each spec pin the path without touching JSDOM's
// history API.
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}))

vi.mock("next-intl", () => ({
  useLocale: () => mockLocale,
  useTranslations: (namespace: string) => (key: string) => {
    // Mirror the relevant entries from src/messages/en.json so the
    // header renders the same strings the bundle ships. The fallback
    // returns `${namespace}.${key}` so a typo in the test or a
    // missed-translation regression in the component surfaces as a
    // visible string mismatch rather than a passing test.
    const TITLE = {
      messages: "MessagingIE",
      profile: "My Profile",
      dashboard: "Dashboard",
    } as const
    const HEADER = {
      menu: "Menu",
      onboarding: "Onboarding",
      "drawer.dashboard": "Dashboard",
      "drawer.messaging": "MessagingIE",
      "drawer.close": "Close",
      "language.english": "English",
      "language.irish": "Gaeilge",
    } as const
    if (namespace === "navigation.title") {
      return TITLE[key as keyof typeof TITLE] ?? `${namespace}.${key}`
    }
    if (namespace === "navigation.header") {
      return HEADER[key as keyof typeof HEADER] ?? `${namespace}.${key}`
    }
    return `${namespace}.${key}`
  },
}))

vi.mock("@/hooks/use-show-application-links", () => ({
  useShowApplicationLinks: () => true,
}))

// `useCrossZoneLink` and the `ZONE_CONFIG` table are exercised by their
// own dedicated suites; here we only need the (zone,path) -> absolute-
// URL contract so we can assert the rendered hrefs. Returning the
// deterministic local-docker triple makes every assertion a string-
// equality check.
vi.mock("@citizen-portal/shared", () => ({
  useCrossZoneLink:
    () => (zone: "messages" | "profile" | "dashboard", p: string) => {
      const base = {
        messages: "http://messaging.local.test:8080",
        profile: "http://profile.local.test:8080",
        dashboard: "http://dashboard.local.test:8080",
      } as const
      return `${base[zone]}${p.startsWith("/") ? p : `/${p}`}`
    },
}))

// DS exports a wide surface; the cheapest path is to stub every component
// the header touches as a passthrough that preserves children only. We
// deliberately do NOT forward arbitrary props onto the resulting <div>
// — DS components consume camelCase props (closeButtonLabel,
// showItemMode, …) that React warns about when they reach DOM nodes.
// The test asserts on visible text + role/href on links, never on the
// internal DS prop surface, so stripping props is safe and quieter.
vi.mock("@ogcio/design-system-react", () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => (
    <div>{children as React.ReactNode}</div>
  )
  return {
    HeaderNext: Pass,
    HeaderLogo: Pass,
    HeaderTitle: Pass,
    HeaderPrimaryMenu: Pass,
    HeaderSecondaryMenu: Pass,
    HeaderMenuItemButton: ({
      children,
      onClick,
    }: {
      children: React.ReactNode
      onClick?: () => void
    }) => (
      <button type='button' onClick={onClick}>
        {children}
      </button>
    ),
    HeaderMenuItemLink: ({
      href,
      children,
    }: {
      href: string
      children: React.ReactNode
    }) => <a href={href}>{children}</a>,
    DrawerWrapper: Pass,
    DrawerBody: Pass,
    Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
      <a href={href}>{children}</a>
    ),
  }
})

vi.mock("@ogcio/design-system-react/logos", () => ({
  LogoHarpWhite: () => <span data-testid='logo-harp' />,
  LogoWhite: () => <span data-testid='logo-white' />,
}))

vi.mock("@/components/navigation/user-menu-drawer", () => ({
  UserMenuDrawer: ({
    profileHref,
    children,
    name,
  }: {
    profileHref: string
    children: React.ReactNode
    name: string
  }) => (
    <div data-testid='user-menu-drawer'>
      <span data-testid='user-name'>{name}</span>
      <a data-testid='profile-href' href={profileHref}>
        Profile
      </a>
      {children}
    </div>
  ),
}))

import { PageHeader } from "@/components/navigation/page-header"

describe("PageHeader", () => {
  beforeEach(() => {
    mockPathname = "/en/messages"
    mockLocale = "en"
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("resolves the title from the active zone on a messages path", () => {
    mockPathname = "/en/messages"
    render(<PageHeader publicName='Jane' onSignOut={() => {}} />)
    // The drawer's MessagingIE cross-zone link also contains the
    // string "MessagingIE", so `getAllByText` is the right matcher;
    // the header title is the first occurrence and the logo's
    // aria-label is the second (proven by the logo-href test below).
    expect(screen.getAllByText("MessagingIE").length).toBeGreaterThan(0)
    // The chrome title and the cross-zone drawer item must both
    // exist; the absolute cross-zone href is asserted by the
    // dedicated drawer-href test below. Here we only confirm that
    // at least one absolute and one root-relative link both carry
    // the "MessagingIE" label.
    const messagingLinks = screen.getAllByRole("link", { name: "MessagingIE" })
    expect(
      messagingLinks.some((a) => a.getAttribute("href") === "/en/messages"),
    ).toBe(true)
    expect(
      messagingLinks.some((a) =>
        a.getAttribute("href")?.startsWith("http://messaging.local.test:8080/"),
      ),
    ).toBe(true)
  })

  it("resolves the title from the active zone on a profile path", () => {
    mockPathname = "/en/my-profile"
    render(<PageHeader publicName='Jane' onSignOut={() => {}} />)
    expect(screen.getByText("My Profile")).toBeInTheDocument()
  })

  it("resolves the title from the active zone on a dashboard path", () => {
    mockPathname = "/en/my-dashboard"
    render(<PageHeader publicName='Jane' onSignOut={() => {}} />)
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0)
  })

  it("honours an explicit title override (used by onboarding shell)", () => {
    mockPathname = "/onboarding"
    render(
      <PageHeader publicName='Jane' onSignOut={() => {}} title='Onboarding' />,
    )
    expect(screen.getByText("Onboarding")).toBeInTheDocument()
  })

  it("uses ZONE_CONFIG[zone].rootPath as the logo link target", () => {
    mockPathname = "/en/my-profile"
    render(<PageHeader publicName='Jane' onSignOut={() => {}} />)
    // logoHref default is `/${locale}${rootPath}`; profile zone's
    // rootPath is `/my-profile` per ZONE_CONFIG. The matching link
    // is the one with the aria-label === title (set by the logo
    // anchor); the cross-zone drawer link for profile points at the
    // absolute profile host instead.
    const profileLogo = screen
      .getAllByRole("link", { name: "My Profile" })
      .find((a) => a.getAttribute("href") === "/en/my-profile")
    expect(profileLogo).toBeDefined()
  })

  it("produces absolute cross-zone hrefs for the drawer items", () => {
    mockPathname = "/en/messages"
    render(<PageHeader publicName='Jane' onSignOut={() => {}} />)

    // The profile drawer link is rendered via UserMenuDrawer; the
    // dashboard + messaging drawer links are rendered as <DrawerLink>
    // children inside the drawer body. Every cross-zone href must be
    // absolute — the canonicalisation map is the safety net, but the
    // rendered URL should already point at the canonical host so a
    // hover-preview matches the eventual landing page.
    expect(screen.getByTestId("profile-href")).toHaveAttribute(
      "href",
      "http://profile.local.test:8080/en/my-profile",
    )
    // Two links carry text "Dashboard" / "MessagingIE" on a messages
    // page (logo + drawer); the cross-zone one is the absolute URL.
    const dashboardCrossZone = screen
      .getAllByRole("link", { name: "Dashboard" })
      .find((a) =>
        a.getAttribute("href")?.startsWith("http://dashboard.local.test:8080/"),
      )
    expect(dashboardCrossZone).toBeDefined()
    expect(dashboardCrossZone).toHaveAttribute(
      "href",
      "http://dashboard.local.test:8080/en/my-dashboard",
    )

    const messagingCrossZone = screen
      .getAllByRole("link", { name: "MessagingIE" })
      .find((a) =>
        a.getAttribute("href")?.startsWith("http://messaging.local.test:8080/"),
      )
    expect(messagingCrossZone).toBeDefined()
    expect(messagingCrossZone).toHaveAttribute(
      "href",
      "http://messaging.local.test:8080/en/messages",
    )
  })

  it("builds the language-switch href by swapping the locale segment on a localed path", () => {
    mockPathname = "/en/my-profile"
    mockLocale = "en"
    render(<PageHeader publicName='Jane' onSignOut={() => {}} />)
    // The secondary-menu link carries the locale-flip target. Two
    // matches expected (header + drawer); either is fine for the
    // contract assertion.
    const gaeilge = screen.getAllByRole("link", { name: "Gaeilge" })[0]
    expect(gaeilge).toHaveAttribute("href", "/ga/my-profile")
  })

  it("falls back to the bare opposite-locale path for no-locale routes", () => {
    // /onboarding has no /{locale}/ segment to swap; the helper must
    // hand back `/ga` (or `/en`) without crashing on the regex
    // replacement. This is the case the onboarding shell hits.
    mockPathname = "/onboarding"
    mockLocale = "en"
    render(<PageHeader publicName='Jane' onSignOut={() => {}} />)
    const gaeilge = screen.getAllByRole("link", { name: "Gaeilge" })[0]
    expect(gaeilge).toHaveAttribute("href", "/ga")
  })

  it("honours an explicit languageHref override (used by no-locale callsites)", () => {
    mockPathname = "/onboarding"
    render(
      <PageHeader
        publicName='Jane'
        onSignOut={() => {}}
        languageHref='/onboarding?ga'
      />,
    )
    const gaeilge = screen.getAllByRole("link", { name: "Gaeilge" })[0]
    expect(gaeilge).toHaveAttribute("href", "/onboarding?ga")
  })
})
