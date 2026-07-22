"use client"

import { SagClientProvider, useSagClient } from "@ogcio/sag-client/react"
import { type ReactNode, useMemo } from "react"
import { coalesceAuthChecks } from "./auth-check-coalesce"
import { getSharedParentDomain } from "./cross-zone"
import { useEnv } from "./env/use-env"

interface CitizenSagProviderProps {
  /**
   * Per-zone identity sent to the gateway. Overrides
   * `NEXT_PUBLIC_SAG_APP_NAME` so each zone (messages / profile /
   * dashboard) can introduce itself as its own SAG app while still
   * sharing the same browser session.
   */
  appName?: string
  /**
   * Optional override for the gateway URL (very rarely needed — usually
   * the env default is correct). Exposed mainly for tests.
   */
  gatewayUrl?: string
  onSessionExpired?: () => void
  children: ReactNode
}

/**
 * Wrapper around `@ogcio/sag-client/react`'s `SagClientProvider` that wires
 * in the citizen-shared env schema. Each zone passes its own `appName` so
 * the gateway can identify which zone made a given request, while the
 * underlying browser session cookie stays shared across all three zones.
 *
 * ---
 *
 * TODO(SAG cross-zone cookie scope, story 1.3):
 *   `@ogcio/sag-client@0.7.1` exposes only `gatewayUrl`, `appName` and
 *   `onSessionExpired` on `SagClientConfig` — there is no client-side
 *   `cookieDomain` / `cookieScope` prop. The session cookie's `Domain`
 *   attribute is set by the Secure API Gateway when it issues the cookie,
 *   so cross-zone cookie sharing is a *gateway-side* concern, not a
 *   provider prop.
 *
 *   To make a single SAG session readable by all three zones
 *   (messaging / profile / dashboard subdomains of `*.services.gov.ie`)
 *   the gateway must set the session cookie with `Domain=.services.gov.ie`
 *   (or the appropriate parent domain per env). `getSharedParentDomain()`
 *   below is the value the gateway *would* need; we re-export it from
 *   this package so a follow-up PR on `@ogcio/sag-client` / the gateway
 *   helm chart can pick it up.
 *
 *   Until that gateway-side change lands, calling this provider on its
 *   own does NOT establish cross-zone session sharing. It is wired so
 *   that the day the gateway/SAG client gain a `cookieDomain` prop, the
 *   value is already computed here and only the prop name needs to be
 *   filled in.
 */
export function CitizenSagProvider({
  appName,
  gatewayUrl,
  onSessionExpired,
  children,
}: CitizenSagProviderProps) {
  const { sagUrl, sagAppName } = useEnv()

  // Computed eagerly so it's visible in the React DevTools tree and so a
  // gateway-side hook (e.g. a small useEffect setting `document.cookie`)
  // can read it without recomputing. Intentionally unused at the props
  // level until the SAG client supports it — see TODO above.
  const _sharedParentDomain =
    typeof window !== "undefined"
      ? getSharedParentDomain(window.location.hostname)
      : undefined
  void _sharedParentDomain

  return (
    <SagClientProvider
      gatewayUrl={gatewayUrl ?? sagUrl}
      appName={appName ?? sagAppName}
      onSessionExpired={onSessionExpired}
    >
      <CoalesceAuthChecks>{children}</CoalesceAuthChecks>
    </SagClientProvider>
  )
}

/**
 * Patches the SAG client's auth/health checks with request coalescing
 * (AB#40680). Rendered directly under `SagClientProvider` so the very first
 * consumer — the onboarding guard — already sees the coalesced methods.
 *
 * The patch runs in `useMemo` (before children render) rather than an effect,
 * because parent effects fire *after* child effects; by the time a `useEffect`
 * here ran, the guard would already have kicked off its un-coalesced fetches.
 */
function CoalesceAuthChecks({ children }: { children: ReactNode }) {
  const client = useSagClient()
  useMemo(() => coalesceAuthChecks(client), [client])
  return <>{children}</>
}
