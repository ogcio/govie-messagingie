"use client"

import {
  HeaderLogo,
  HeaderMenuItemLink,
  HeaderNext,
  HeaderSecondaryMenu,
  HeaderTitle,
} from "@ogcio/design-system-react"
import { LogoHarpWhite, LogoWhite } from "@ogcio/design-system-react/logos"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { ApplicationFooter } from "@/components/layout/application-footer"
import { AppMainContent } from "@/components/layout/containers"
import { PageLoading } from "@/components/page-loading"
import { LANG_EN, LANG_GA } from "@/const"
import { useActiveLocale } from "@/hooks/use-active-locale"
import { isLeaEnabled } from "@/lib/feature-config"
import { ZONE_CONFIG } from "@/lib/zone-config"
import type { Zone } from "@/util/get-zone-from-path"

/**
 * Lightweight authenticated chrome shown while auth/onboarding resolves.
 * Renders the static header bar + footer immediately so refresh never feels
 * like a blank page, with only the main content area showing a spinner.
 *
 * Intentionally avoids `PageHeader` (and its profile SAFE fetch) until the
 * session is ready.
 */
export function ShellLoadingChrome({ zone }: { zone: Zone }) {
  const locale = useActiveLocale()
  const path = usePathname()
  const t = useTranslations("navigation.header")
  const titleT = useTranslations("navigation.title")
  const zoneRootPath = ZONE_CONFIG[zone].rootPath
  const isApplicationsSurface = path.includes("/my-applications")

  const headerTitle =
    isApplicationsSurface && isLeaEnabled()
      ? titleT("applications")
      : titleT(zone)
  const headerLogoHref = isApplicationsSurface
    ? `/${locale}/my-applications`
    : `/${locale}${zoneRootPath}`

  const isEnglish = locale === LANG_EN
  const oppositeLocale = isEnglish ? LANG_GA : LANG_EN
  const oppositeLabel = isEnglish ? t("language.irish") : t("language.english")
  const languageHref = path.includes(`/${locale}/`)
    ? path.replace(`/${locale}/`, `/${oppositeLocale}/`)
    : `/${oppositeLocale}`

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
          <HeaderMenuItemLink href={languageHref}>
            {oppositeLabel}
          </HeaderMenuItemLink>
        </HeaderSecondaryMenu>
      </HeaderNext>
      <AppMainContent>
        <PageLoading minHeight='50vh' />
      </AppMainContent>
      <ApplicationFooter />
    </>
  )
}
