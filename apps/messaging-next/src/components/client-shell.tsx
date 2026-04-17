"use client"

import { faro } from "@grafana/faro-web-sdk"
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
  Paragraph,
  Spinner,
  Stack,
  ToastProvider,
} from "@ogcio/design-system-react"
import {
  CONNECTOR_MYGOVID,
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
  useRef,
  useState,
} from "react"
import { ConsentBanner } from "@/components/consent-banner"
import { FeatureFlagsProvider } from "@/components/feature-flags-provider"
import { MainContainer } from "@/components/layout/containers"
import { MessagingAnalyticsProvider } from "@/components/messaging-analytics-provider"
import { PageHeader } from "@/components/navigation/page-header"
import { env } from "@/env/env.client"
import { useRouter } from "@/i18n/navigation"

const AUTH_TIMEOUT_MS = 15_000

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

  return <AuthenticatedShell>{children}</AuthenticatedShell>
}

function AuthenticatedShell({ children }: { children: ReactNode }) {
  const { user, loading, signIn, signOut } = useAuth()
  const locale = useLocale()
  const router = useRouter()
  const signInTriggered = useRef(false)

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
      signIn({ connector: CONNECTOR_MYGOVID })
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
          locale={locale as ConsentStatementLanguages}
          isPublicServant={false}
          onLocaleChange={handleLocaleChange}
          languageSwitcher={{
            translations: { english: "English", irish: "Gaeilge" },
          }}
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
            },
            onConsentError: (error) => {
              faro.api?.pushLog([`Consent error: ${error}`])
            },
          }}
        >
          <Suspense fallback={<LayoutLoading />}>
            <PageHeader
              publicName={user.name ?? user.email ?? user.sub}
              onSignOut={signOut}
            />
            <MainContainer>
              <Container>
                <Stack direction='row' wrap gap={10}>
                  <div style={{ width: "100%" }}>
                    <ConsentBanner />
                    {children}
                  </div>
                </Stack>
              </Container>
            </MainContainer>
          </Suspense>
        </ConsentProvider>
      </FeatureFlagsProvider>
    </MessagingAnalyticsProvider>
  )
}

export function ClientShell({ children }: { children: ReactNode }) {
  return (
    <SagClientProvider
      gatewayUrl={env.NEXT_PUBLIC_SAG_URL}
      appName={env.NEXT_PUBLIC_SAG_APP_NAME}
    >
      <ShellContent>{children}</ShellContent>
    </SagClientProvider>
  )
}
