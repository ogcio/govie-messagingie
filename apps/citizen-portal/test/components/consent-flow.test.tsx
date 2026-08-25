import { render } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const trackEvent = vi.hoisted(() => vi.fn())
const capturedEvents = vi.hoisted(
  () => ({}) as { onConsentDecision?: (accepted: boolean) => void },
)

vi.mock("@ogcio/nextjs-analytics", () => ({
  useAnalytics: () => ({ trackEvent }),
}))
vi.mock("@ogcio/consent/react", () => ({
  FORCE_CONSENT_PARAM: "force-consent",
  MESSAGING_CONSENT_SUBJECT: "messaging",
  ConsentProvider: ({
    children,
    events,
  }: {
    children: ReactNode
    events: { onConsentDecision: (accepted: boolean) => void }
  }) => {
    capturedEvents.onConsentDecision = events.onConsentDecision
    return <>{children}</>
  },
}))
vi.mock("@grafana/faro-web-sdk", () => ({
  faro: { api: { pushLog: vi.fn() } },
}))
// client-shell.tsx module-level imports pull in `@ogcio/sag-client/react`
// (for AuthenticatedShell/useOnboardingGuard, not used by ConsentFlow
// itself); the real package fails to resolve its `onboarding` submodule
// under vitest's resolver, so it must be stubbed regardless.
vi.mock("@ogcio/sag-client/react", () => ({
  CONNECTOR_MYGOVID: "mygovid",
  ROLE_NAME_ONBOARDED_CITIZEN: "Onboarded citizen",
  // ZONE_CONFIG (imported transitively via client-shell.tsx) pulls in these
  // role constants — stub them so the per-zone table loads under vitest.
  MESSAGING_PUBLIC_SERVANT_ROLE_NAME: "Messaging Public Servant",
  PROFILE_PUBLIC_SERVANT_ROLE_NAME: "Profile Public Servant",
  useAuth: () => ({
    user: undefined,
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
  useOnboardingGuard: () => ({ resolved: true }),
}))
vi.mock("@ogcio/sag-client", () => ({
  signIn: vi.fn(),
}))
// `@/i18n/navigation` wraps next-intl's `createNavigation`, which pulls in
// `next/navigation` in a way that doesn't resolve under vitest — stub the
// one export client-shell.tsx uses (`useRouter`, only called by
// `AuthenticatedShell`, not by `ConsentFlow`).
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}))
vi.mock("@citizen-portal/shared", () => ({
  CitizenSagProvider: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  getEnv: () => ({ sagUrl: "http://sag.local.test", sagAppName: "messaging" }),
  useCrossZoneLink: () => (_zone: string, path: string) => path,
}))
// AnnouncementsFlow pulls in `@ogcio/consent/react`'s `useConsent`, which the
// mock above doesn't provide — stub the component itself as a passthrough,
// matching the "mock the neighbour component" idiom used elsewhere in this
// test suite (see announcements-flow.test.tsx for the real component's own
// coverage).
vi.mock("@/components/announcements-flow", () => ({
  AnnouncementsFlow: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

import { ConsentFlow } from "@/components/client-shell"

describe("ConsentFlow analytics", () => {
  beforeEach(() => trackEvent.mockClear())

  it("fires consent-accepted on an accepting decision", () => {
    render(
      <ConsentFlow locale='en' onLocaleChange={() => {}}>
        {null}
      </ConsentFlow>,
    )
    capturedEvents.onConsentDecision?.(true)
    expect(trackEvent).toHaveBeenCalledWith({
      event: {
        name: "consent-accepted",
        category: "Consent",
        action: "Consent Accepted",
      },
    })
  })

  it("fires consent-declined on a declining decision", () => {
    render(
      <ConsentFlow locale='en' onLocaleChange={() => {}}>
        {null}
      </ConsentFlow>,
    )
    capturedEvents.onConsentDecision?.(false)
    expect(trackEvent).toHaveBeenCalledWith({
      event: {
        name: "consent-declined",
        category: "Consent",
        action: "Consent Declined",
      },
    })
  })
})
