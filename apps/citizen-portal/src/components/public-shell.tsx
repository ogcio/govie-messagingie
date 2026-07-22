"use client"

import {
  Container,
  HeaderLogo,
  HeaderMenuItemLink,
  HeaderNext,
  HeaderSecondaryMenu,
  HeaderTitle,
} from "@ogcio/design-system-react"
import { LogoHarpWhite, LogoWhite } from "@ogcio/design-system-react/logos"
import { usePathname, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { type ReactNode, Suspense } from "react"
import { ApplicationFooter } from "@/components/layout/application-footer"
import { MainContainer } from "@/components/layout/containers"
import { LANG_EN, LANG_GA } from "@/const"
import { useActiveLocale } from "@/hooks/use-active-locale"
import { ZONE_CONFIG } from "@/lib/zone-config"
import { getZoneFromPath } from "@/util/get-zone-from-path"
import { buildLocaleSwitchHref } from "@/util/locale-switch-href"

/**
 * Unauthenticated chrome for the public route group (privacy policy,
 * cookie policy, accessibility statement, terms of use, contact support)
 * and any future signed-out informational pages.
 *
 * No SAG provider, no drawer, no user menu — just the standard header
 * with the language switcher and the policy footer. Visitors who land
 * here while authenticated still see the page content normally; the
 * shell intentionally doesn't try to render an authenticated header
 * because public pages must be reachable without a session.
 */
type PublicShellProps = {
  children: ReactNode
  title?: string
  logoHref?: string
  showContactSupport?: boolean
}

function PublicShellLanguageLink({
  path,
  locale,
  oppositeLocale,
  oppositeLabel,
}: {
  path: string
  locale: string
  oppositeLocale: string
  oppositeLabel: string
}) {
  const searchParams = useSearchParams()
  const languageHref = buildLocaleSwitchHref(
    path,
    locale,
    oppositeLocale,
    searchParams,
  )

  return (
    <HeaderMenuItemLink href={languageHref}>{oppositeLabel}</HeaderMenuItemLink>
  )
}

export function PublicShell({
  children,
  title,
  logoHref,
  showContactSupport = true,
}: PublicShellProps) {
  const locale = useActiveLocale()
  const path = usePathname()
  const tNav = useTranslations("navigation.header")
  const titleT = useTranslations("navigation.title")

  const zone = getZoneFromPath(path)
  const headerTitle = title ?? titleT(zone)
  const headerLogoHref = logoHref ?? `/${locale}${ZONE_CONFIG[zone].rootPath}`

  const isEnglish = locale === LANG_EN
  const oppositeLocale = isEnglish ? LANG_GA : LANG_EN
  const oppositeLabel = isEnglish
    ? tNav("language.irish")
    : tNav("language.english")
  const fallbackLanguageHref = buildLocaleSwitchHref(
    path,
    locale,
    oppositeLocale,
  )

  return (
    <>
      <HeaderNext variant='default'>
        <HeaderLogo>
          <a href={headerLogoHref} aria-label={headerTitle}>
            <LogoHarpWhite className='gi-h-10 sm:gi-hidden' />
            <LogoWhite className='gi-hidden sm:gi-block gi-h-14' />
          </a>
        </HeaderLogo>
        <HeaderTitle>{headerTitle}</HeaderTitle>
        <HeaderSecondaryMenu>
          <Suspense
            fallback={
              <HeaderMenuItemLink href={fallbackLanguageHref}>
                {oppositeLabel}
              </HeaderMenuItemLink>
            }
          >
            <PublicShellLanguageLink
              path={path}
              locale={locale}
              oppositeLocale={oppositeLocale}
              oppositeLabel={oppositeLabel}
            />
          </Suspense>
        </HeaderSecondaryMenu>
      </HeaderNext>
      <MainContainer>
        <Container insetTop='xl'>
          <div style={{ maxWidth: "720px" }}>{children}</div>
        </Container>
      </MainContainer>
      <ApplicationFooter
        showContactSupport={showContactSupport}
        showWhatsNew={false}
      />
    </>
  )
}
