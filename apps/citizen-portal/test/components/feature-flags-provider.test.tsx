import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Runtime submission-linking flag (AB#39580). Defaults ON so it matches a
// fully-flagged deployment whose `submission-linking` toggle is enabled,
// even while flags are loading or Unleash is unreachable.
const unleash = vi.hoisted(() => ({
  flags: {
    "unified-inbox": false,
    "export-user": false,
    "submission-linking": true,
  } as Record<string, boolean>,
}))
const fallback = vi.hoisted(() => ({
  isFlagsReady: true,
  useFallbackValues: false,
}))
const env = vi.hoisted(() => ({
  NEXT_PUBLIC_UNLEASH_URL: "http://unleash.test/api/frontend" as
    | string
    | undefined,
  NEXT_PUBLIC_UNLEASH_CLIENT_KEY: "client-key" as string | undefined,
  NEXT_PUBLIC_UNLEASH_APP_NAME: "citizen-portal",
}))

vi.mock("@unleash/proxy-client-react", () => ({
  FlagProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useFlag: (name: string) => unleash.flags[name] ?? false,
  useUnleashContext: () => () => {},
}))

vi.mock("@ogcio/sag-client/react", () => ({
  useAuth: () => ({ user: { sub: "user-1" } }),
}))

vi.mock("@/hooks/use-flags-ready-with-fallback", () => ({
  useFlagsReadyWithFallback: () => fallback,
}))

vi.mock("@/env/env.client", () => ({ env }))

import {
  FeatureFlagsProvider,
  useFeatureFlags,
} from "@/components/feature-flags-provider"

function Probe() {
  const flags = useFeatureFlags()
  return (
    <div data-testid='submission'>
      {String(flags.isSubmissionLinkingEnabled)}
    </div>
  )
}

const renderProbe = () =>
  render(
    <FeatureFlagsProvider>
      <Probe />
    </FeatureFlagsProvider>,
  )

describe("FeatureFlagsProvider — submission-linking", () => {
  beforeEach(() => {
    unleash.flags = {
      "unified-inbox": false,
      "export-user": false,
      "submission-linking": true,
    }
    fallback.isFlagsReady = true
    fallback.useFallbackValues = false
    env.NEXT_PUBLIC_UNLEASH_URL = "http://unleash.test/api/frontend"
    env.NEXT_PUBLIC_UNLEASH_CLIENT_KEY = "client-key"
  })

  it("defaults ON when Unleash is unconfigured (e.g. standalone deploy)", () => {
    env.NEXT_PUBLIC_UNLEASH_URL = undefined
    env.NEXT_PUBLIC_UNLEASH_CLIENT_KEY = undefined
    renderProbe()
    expect(screen.getByTestId("submission")).toHaveTextContent("true")
  })

  it("is ON when the flag is enabled and flags are ready", () => {
    unleash.flags["submission-linking"] = true
    renderProbe()
    expect(screen.getByTestId("submission")).toHaveTextContent("true")
  })

  it("is OFF when the flag is explicitly turned off and flags are ready", () => {
    unleash.flags["submission-linking"] = false
    renderProbe()
    expect(screen.getByTestId("submission")).toHaveTextContent("false")
  })

  it("stays ON while falling back (flags not ready / proxy unreachable)", () => {
    unleash.flags["submission-linking"] = false
    fallback.useFallbackValues = true
    renderProbe()
    expect(screen.getByTestId("submission")).toHaveTextContent("true")
  })
})
