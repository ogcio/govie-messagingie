import { render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AnalyticsProviderWrapper } from "./analytics-provider-wrapper"
import { FeatureFlagsProvider, useFeatureFlags } from "./FeatureFlagsProvider"
import { UserProvider, useUser, useUserRoles } from "./UserContext"

const {
  analyticsProvider,
  auth,
  env,
  flagProvider,
  organizationContext,
  updateContext,
} = vi.hoisted(() => ({
  analyticsProvider: vi.fn(),
  auth: vi.fn(),
  env: {
    NEXT_PUBLIC_ANALYTICS_URL: undefined as string | undefined,
    NEXT_PUBLIC_ANALYTICS_WEBSITE_ID: "website",
    NEXT_PUBLIC_ANALYTICS_ORGANIZATION_ID: "organization",
    NEXT_PUBLIC_ANALYTICS_DRY_RUN: true,
    NEXT_PUBLIC_UNLEASH_URL: undefined as string | undefined,
    NEXT_PUBLIC_UNLEASH_CLIENT_KEY: undefined as string | undefined,
    NEXT_PUBLIC_UNLEASH_APP_NAME: "portal",
  },
  flagProvider: vi.fn(),
  organizationContext: vi.fn(),
  updateContext: vi.fn(),
}))

vi.mock("@/env/env.client", () => ({ env }))
vi.mock("@ogcio/nextjs-analytics", () => ({
  AnalyticsProvider: ({
    children,
    config,
  }: {
    children: ReactNode
    config: unknown
  }) => {
    analyticsProvider(config)
    return <div data-testid='analytics-provider'>{children}</div>
  },
}))
vi.mock("@ogcio/sag-client/react", () => ({
  PROFILE_PUBLIC_SERVANT_ROLE_NAME: "profile",
  UPLOAD_PUBLIC_SERVANT_ROLE_NAME: "upload",
  useAuth: () => auth(),
}))
vi.mock("@/hooks/use-organization-context", () => ({
  useOrganizationContext: () => organizationContext(),
}))
vi.mock("@unleash/proxy-client-react", () => ({
  FlagProvider: ({
    children,
    config,
  }: {
    children: ReactNode
    config: unknown
  }) => {
    flagProvider(config)
    return <div data-testid='flag-provider'>{children}</div>
  },
  useFlagsStatus: () => ({ flagsReady: true }),
  useUnleashContext: () => updateContext,
}))

function UserConsumer() {
  const user = useUser()
  const roles = useUserRoles()
  return (
    <span>
      {user.name}:{String(roles.canCreateProfiles)}:
      {String(roles.canUploadFiles)}
    </span>
  )
}

function FlagsConsumer() {
  return <span data-testid='flags'>{JSON.stringify(useFeatureFlags())}</span>
}

describe("providers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    env.NEXT_PUBLIC_ANALYTICS_URL = undefined
    env.NEXT_PUBLIC_UNLEASH_URL = undefined
    env.NEXT_PUBLIC_UNLEASH_CLIENT_KEY = undefined
    auth.mockReturnValue({ user: undefined, claims: undefined })
    organizationContext.mockReturnValue({
      currentOrganization: undefined,
      organizations: [],
    })
  })

  it("passes children through when analytics is unconfigured", () => {
    render(<AnalyticsProviderWrapper>content</AnalyticsProviderWrapper>)
    expect(screen.getByText("content")).toBeInTheDocument()
    expect(screen.queryByTestId("analytics-provider")).not.toBeInTheDocument()
  })

  it("configures the analytics provider", () => {
    env.NEXT_PUBLIC_ANALYTICS_URL = "https://analytics.example"
    render(<AnalyticsProviderWrapper>content</AnalyticsProviderWrapper>)
    expect(screen.getByTestId("analytics-provider")).toBeInTheDocument()
    expect(analyticsProvider).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: "https://analytics.example" }),
    )
  })

  it("uses a local feature context when Unleash is unconfigured", () => {
    render(
      <FeatureFlagsProvider>
        <FlagsConsumer />
      </FeatureFlagsProvider>,
    )
    expect(screen.getByTestId("flags")).toHaveTextContent("{}")
    expect(flagProvider).not.toHaveBeenCalled()
  })

  it("configures Unleash and identifies the signed-in user", async () => {
    env.NEXT_PUBLIC_UNLEASH_URL = "https://flags.example"
    env.NEXT_PUBLIC_UNLEASH_CLIENT_KEY = "key"
    auth.mockReturnValue({ user: { sub: "user-1" }, claims: {} })
    render(<FeatureFlagsProvider>content</FeatureFlagsProvider>)
    expect(screen.getByTestId("flag-provider")).toBeInTheDocument()
    expect(flagProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://flags.example",
        clientKey: "key",
      }),
    )
    await waitFor(() =>
      expect(updateContext).toHaveBeenCalledWith({ userId: "user-1" }),
    )
  })

  it("maps authenticated user and organization roles into context", () => {
    auth.mockReturnValue({
      user: { sub: "user-1", email: "user@example.com" },
      claims: {},
    })
    organizationContext.mockReturnValue({
      currentOrganization: {
        id: "org-1",
        name: "Department",
        roles: ["profile", "upload"],
      },
      organizations: [
        { id: "org-1", name: "Department", roles: ["profile", "upload"] },
      ],
    })
    render(
      <UserProvider>
        <UserConsumer />
      </UserProvider>,
    )
    expect(screen.getByText("user@example.com:true:true")).toBeInTheDocument()
  })

  it("renders nothing without auth and rejects useUser outside its provider", () => {
    const { container } = render(<UserProvider>content</UserProvider>)
    expect(container).toBeEmptyDOMElement()
    expect(() => render(<UserConsumer />)).toThrow(
      "useUser must be used within UserProvider",
    )
  })
})
