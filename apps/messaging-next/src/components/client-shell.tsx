"use client"

import { faro, LogLevel } from "@grafana/faro-web-sdk"
import type { ConsentStatementLanguages } from "@ogcio/consent"
import {
  ConsentProvider,
  FORCE_CONSENT_PARAM,
  MESSAGING_CONSENT_SUBJECT,
} from "@ogcio/consent/react"
import {
  Button,
  Container,
  Heading,
  LoadMaterialSymbols,
  Paragraph,
  Spinner,
  Stack,
  ToastProvider,
} from "@ogcio/design-system-react"
import { signIn } from "@ogcio/sag-client"
import {
  CONNECTOR_MYGOVID,
  ROLE_NAME_ONBOARDED_CITIZEN,
  SagClientProvider,
  useAuth,
  useOnboardingGuard,
} from "@ogcio/sag-client/react"
import { useLocale, useTranslations } from "next-intl"
import {
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { AnnouncementsFlow } from "@/components/announcements-flow"
import { ConsentBanner } from "@/components/consent-banner"
import { FeatureFlagsProvider } from "@/components/feature-flags-provider"
import { MainContainer } from "@/components/layout/containers"
import { MessagingAnalyticsProvider } from "@/components/messaging-analytics-provider"
import { PageHeader } from "@/components/navigation/page-header"
import { TRACE_MESSAGES } from "@/const/traces"
import { env } from "@/env/env.client"
import { useRouter } from "@/i18n/navigation"
import {
  clearPersistedForceConsent,
  persistForceConsentFromUrl,
} from "@/util/force-consent"

const AUTH_TIMEOUT_MS = 15_000
const LANGUAGE_SWITCHER = {
  translations: { english: "English", irish: "Gaeilge" },
} as const

// One-shot guard against the post-onboarding stale-claims race: when the user
// returns from the profile-service onboarding flow, the SAG session can still
// hold the pre-onboarding ID token (no `Onboarded citizen` role). Detect that
// here, force one fresh sign-in cycle, and bound retries with sessionStorage
// so we never loop. Works regardless of which profile app handled onboarding
// (legacy `profile` or `profile-next`).
const STALE_CLAIMS_REFRESH_KEY = "messaging_next_stale_claims_refreshed"

function LayoutLoading() {
  return (
    <output
      aria-label='Loading'
      className='gi-flex gi-items-center gi-justify-center'
      style={{ minHeight: "50vh" }}
    >
      <Spinner size='xl' />
    </output>
  )
}

function AuthTimeoutError() {
  const t = useTranslations("errors.page")

  return (
    <div
      className='gi-flex gi-items-center gi-justify-center'
      style={{ minHeight: "50vh" }}
    >
      <Stack
        direction='column'
        gap={4}
        role='alert'
        aria-live='assertive'
        aria-atomic='true'
      >
        <Heading as='h2'>{t("title")}</Heading>
        <Paragraph>{t("message")}</Paragraph>
        <div>
          <Button onClick={() => window.location.reload()}>{t("retry")}</Button>
        </div>
      </Stack>
    </div>
  )
}

function useAuthTimeout(resolved: boolean) {
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (resolved) return
    const id = window.setTimeout(() => setTimedOut(true), AUTH_TIMEOUT_MS)
    return () => window.clearTimeout(id)
  }, [resolved])

  return timedOut
}

function ShellContent({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    persistForceConsentFromUrl()
  }, [])

  const { resolved } = useOnboardingGuard({
    profileUrl: env.NEXT_PUBLIC_PROFILE_URL,
    appBaseUrl: env.NEXT_PUBLIC_BASE_URL,
    connector: CONNECTOR_MYGOVID,
    publicServantRedirectUrl: env.NEXT_PUBLIC_MESSAGING_ADMIN_URL,
  })

  const timedOut = useAuthTimeout(resolved)

  if (timedOut && !resolved) {
    return <AuthTimeoutError />
  }

  if (!resolved) {
    return <LayoutLoading />
  }

  return (
    <StaleClaimsRefreshGate>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </StaleClaimsRefreshGate>
  )
}

function StaleClaimsRefreshGate({ children }: { children: ReactNode }) {
  const { user, claims, invalidateSession } = useAuth()
  const [refreshing, setRefreshing] = useState(false)
  const triggered = useRef(false)

  useEffect(() => {
    if (!user || !claims || triggered.current) return

    // PS users are redirected away by `useOnboardingGuard` before we get
    // here — gating on citizens only is just defense in depth.
    const isCitizen = claims.organization_roles.length === 0
    if (!isCitizen) return

    const isOnboarded = claims.roles?.includes(ROLE_NAME_ONBOARDED_CITIZEN)
    const previousAttemptTs = sessionStorage.getItem(STALE_CLAIMS_REFRESH_KEY)

    if (isOnboarded) {
      if (previousAttemptTs) {
        // Recovered after a refresh attempt earlier this session.
        faro.api?.pushLog([
          TRACE_MESSAGES.STALE_CLAIMS_REFRESH.RECOVERED,
          {
            context: {
              previousAttemptTs,
              roleCount: claims.roles?.length ?? 0,
              orgCount: claims.organizations.length,
            },
          },
        ])
      }
      sessionStorage.removeItem(STALE_CLAIMS_REFRESH_KEY)
      return
    }

    // Already attempted this session. Fall through with whatever claims we
    // have so a stuck IdP / propagation issue can't trap the user in a
    // refresh loop — same behaviour as before this gate existed.
    if (previousAttemptTs) {
      faro.api?.pushLog(
        [
          TRACE_MESSAGES.STALE_CLAIMS_REFRESH.SKIPPED_ALREADY_ATTEMPTED,
          {
            context: {
              previousAttemptTs,
              roles: claims.roles ?? [],
              orgRoleCount: claims.organization_roles.length,
            },
          },
        ],
        { level: LogLevel.WARN },
      )
      return
    }

    faro.api?.pushLog([
      TRACE_MESSAGES.STALE_CLAIMS_REFRESH.DETECTED,
      {
        context: {
          // Role *names* are not PII; user identifiers are intentionally omitted.
          roles: claims.roles ?? [],
          orgRoleCount: claims.organization_roles.length,
          signinMethod: claims.signinMethod,
        },
      },
    ])

    triggered.current = true
    sessionStorage.setItem(STALE_CLAIMS_REFRESH_KEY, String(Date.now()))
    setRefreshing(true)
    invalidateSession()
      .catch((error: unknown) => {
        faro.api?.pushLog(
          [
            TRACE_MESSAGES.STALE_CLAIMS_REFRESH.INVALIDATE_FAILED,
            {
              context: {
                error: error instanceof Error ? error.message : String(error),
              },
            },
          ],
          { level: LogLevel.ERROR },
        )
      })
      .finally(() => {
        window.location.reload()
      })
  }, [user, claims, invalidateSession])

  if (refreshing) return <LayoutLoading />
  return <>{children}</>
}

function AuthenticatedShell({ children }: { children: ReactNode }) {
  const { user, loading, signIn, signOut } = useAuth()
  const locale = useLocale()
  const router = useRouter()
  const signInTriggered = useRef(false)
  const currentLocale = locale as ConsentStatementLanguages

  useLayoutEffect(() => {
    persistForceConsentFromUrl()
  }, [])

  const isReady = !loading && !!user
  const timedOut = useAuthTimeout(isReady)

  const handleLocaleChange = useCallback(
    (newLocale: ConsentStatementLanguages) => {
      router.replace({ pathname: "/messages" }, { locale: newLocale })
    },
    [router],
  )

  useEffect(() => {
    if (!loading && !user && !signInTriggered.current) {
      signInTriggered.current = true
      // Pass the full current URL (including query string) as the post-login
      // redirect target. Without this, the gateway falls back to the Referer
      // header which — under the "strict-origin-when-cross-origin" policy
      // set in nginx — is stripped to the origin only, dropping the path and
      // query (e.g. the `?id=<messageId>` on /secure-messages).
      signIn({
        connector: CONNECTOR_MYGOVID,
        redirectUrl: window.location.href,
      })
    }
  }, [loading, user, signIn])

  if (timedOut && !isReady) {
    return <AuthTimeoutError />
  }

  if (loading || !user) {
    return <LayoutLoading />
  }

  return (
    <MessagingAnalyticsProvider>
      <FeatureFlagsProvider>
        <ToastProvider />
        <ConsentProvider
          subject={MESSAGING_CONSENT_SUBJECT}
          locale={currentLocale}
          isPublicServant={false}
          onLocaleChange={handleLocaleChange}
          languageSwitcher={LANGUAGE_SWITCHER}
          events={{
            onConsentDecision: (accepted) => {
              faro.api?.pushLog([
                `Consent decision: ${accepted ? "accepted" : "declined"}`,
              ])

              const url = new URL(window.location.href)
              if (url.searchParams.has(FORCE_CONSENT_PARAM)) {
                url.searchParams.delete(FORCE_CONSENT_PARAM)
                window.history.replaceState(history.state, "", url)
              }
              clearPersistedForceConsent()
            },
            onConsentError: (error) => {
              faro.api?.pushLog([`Consent error: ${error}`])
            },
          }}
        >
          <AnnouncementsFlow
            locale={currentLocale}
            onLocaleChange={handleLocaleChange}
            languageSwitcher={LANGUAGE_SWITCHER}
          >
            <Suspense fallback={<LayoutLoading />}>
              <PageHeader
                publicName={user.name ?? user.email ?? user.sub}
                onSignOut={signOut}
              />
              <MainContainer>
                <Container fullWidth>
                  <Stack direction='row' wrap gap={10}>
                    <div className='gi-w-full'>
                      <ConsentBanner />
                      {children}
                    </div>
                  </Stack>
                </Container>
              </MainContainer>
            </Suspense>
          </AnnouncementsFlow>
        </ConsentProvider>
      </FeatureFlagsProvider>
    </MessagingAnalyticsProvider>
  )
}

export function ClientShell({ children }: { children: ReactNode }) {
  const handleSessionExpired = useCallback(() => {
    persistForceConsentFromUrl()
    signIn(env.NEXT_PUBLIC_SAG_URL, env.NEXT_PUBLIC_SAG_APP_NAME, {
      connector: CONNECTOR_MYGOVID,
      redirectUrl: window.location.href,
    })
  }, [])

  return (
    <SagClientProvider
      gatewayUrl={env.NEXT_PUBLIC_SAG_URL}
      appName={env.NEXT_PUBLIC_SAG_APP_NAME}
      onSessionExpired={handleSessionExpired}
    >
      {/*
       * Inject the DS <link rel=stylesheet> to the Material Symbols font so
       * DS `Icon` can render every id in its set as a font glyph. The SSR'd
       * <link> is hoisted by React 19 into <head>, so it's safe to mount
       * deep in the client tree.
       */}
      <LoadMaterialSymbols />
      <ShellContent>{children}</ShellContent>
    </SagClientProvider>
  )
}
