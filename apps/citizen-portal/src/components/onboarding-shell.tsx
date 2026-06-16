"use client"

import { CitizenSagProvider } from "@citizen-portal/shared"
import { Container } from "@ogcio/design-system-react"
import { useAuth } from "@ogcio/sag-client/react"
import { useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { ApplicationFooter } from "@/components/layout/application-footer"
import { AppMainContent } from "@/components/layout/containers"
import { PageHeader } from "@/components/navigation/page-header"
import { LANG_EN, LANG_GA } from "@/const"
import { ZONE_CONFIG } from "@/lib/zone-config"

/**
 * Chrome for the no-locale `/onboarding` flow. Uses the shared
 * `PageHeader` and `ApplicationFooter` with explicit title and logoHref
 * overrides so the chrome reads as "Onboarding" instead of the default
 * zone title — and clicking the logo loops the user back to /onboarding
 * (any other destination would bypass the very flow we're in).
 *
 * SAG provider uses the profile app name: onboarding mints the
 * `Onboarded citizen` role via the profile service.
 */
function OnboardingShellInner({ children }: { children: ReactNode }) {
  const tNav = useTranslations("navigation.header")
  const { user, signOut } = useAuth()
  const locale = useLocale()
  const searchParams = useSearchParams()
  const displayName =
    user?.name ?? user?.email ?? user?.sub ?? tNav("onboarding")

  // /onboarding has no locale URL segment, so the language toggle flips the
  // `?lng=` param in place (preserving `source`) instead of the default
  // PageHeader behaviour, which would navigate to the locale home and drop
  // the user out of the onboarding flow.
  const oppositeLocale = locale === LANG_EN ? LANG_GA : LANG_EN
  const source = searchParams.get("source")
  const sourceSuffix = source ? `&source=${encodeURIComponent(source)}` : ""
  const languageHref = `/onboarding?lng=${oppositeLocale}${sourceSuffix}`

  return (
    <>
      <PageHeader
        publicName={displayName}
        onSignOut={signOut}
        title={tNav("onboarding")}
        logoHref='/onboarding'
        languageHref={languageHref}
      />
      <AppMainContent>
        <Container insetTop='xl'>
          <div style={{ maxWidth: "720px" }}>{children}</div>
        </Container>
      </AppMainContent>
      <ApplicationFooter showContactSupport={false} />
    </>
  )
}

export function OnboardingShell({ children }: { children: ReactNode }) {
  return (
    <CitizenSagProvider appName={ZONE_CONFIG.profile.sagAppName}>
      <OnboardingShellInner>{children}</OnboardingShellInner>
    </CitizenSagProvider>
  )
}
