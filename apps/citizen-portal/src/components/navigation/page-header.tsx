"use client"

import { useCrossZoneLink } from "@citizen-portal/shared"
import {
  DrawerBody,
  DrawerWrapper,
  HeaderLogo,
  HeaderMenuItemButton,
  HeaderMenuItemLink,
  HeaderNext,
  HeaderPrimaryMenu,
  HeaderSecondaryMenu,
  HeaderTitle,
  ListItem,
} from "@ogcio/design-system-react"
import { LogoHarpWhite, LogoWhite } from "@ogcio/design-system-react/logos"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { LANG_EN, LANG_GA } from "@/const"
import { useActiveLocale } from "@/hooks/use-active-locale"
import { useShowApplicationLinks } from "@/hooks/use-show-application-links"
import { isLeaEnabled, isZoneEnabled } from "@/lib/feature-config"
import { ZONE_CONFIG } from "@/lib/zone-config"
import { getZoneFromPath } from "@/util/get-zone-from-path"
import { UserMenuDrawer } from "./user-menu-drawer"

/**
 * Shared header shown in the authenticated shell of every zone.
 *
 * Unified from messages and profile in Phase B2. The profile zone had
 * the more abstracted signature (title / logoHref / languageHref
 * overrides + `useShowApplicationLinks` gating cross-zone links), so
 * that became the canonical shape. Defaults now derive from the
 * current zone:
 *
 *   - `title`       — `navigation.title.{zone}` (messages →
 *                     "MessagingIE", profile → "My Profile",
 *                     dashboard → "Dashboard"). Overridable for
 *                     pages that want a different chrome title
 *                     (e.g. profile's onboarding shell).
 *   - `logoHref`    — `/{locale}{ZONE_CONFIG[zone].rootPath}`. Same
 *                     override hook as `title`.
 *   - `languageHref`— mirror the current path under the opposite
 *                     locale, with a fallback when the path has no
 *                     locale segment (no-locale routes like /onboarding
 *                     pass an explicit override).
 *
 * The drawer items (Dashboard / MessagingIE / language) are the same
 * for every zone; the previous per-zone implementations all listed
 * the same three items in the same order.
 */
export function PageHeader({
  publicName,
  onSignOut,
  title,
  logoHref,
  languageHref: languageHrefOverride,
}: {
  publicName: string
  onSignOut: () => void
  title?: string
  logoHref?: string
  languageHref?: string
}) {
  const locale = useActiveLocale()
  const path = usePathname()
  const t = useTranslations("navigation.header")
  const titleT = useTranslations("navigation.title")
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const showApplicationLinks = useShowApplicationLinks()

  const zone = getZoneFromPath(path)
  const zoneRootPath = ZONE_CONFIG[zone].rootPath

  // LEA applications list/detail live under the dashboard zone but get their
  // own chrome title and logo target — same pattern as messages owning
  // "MessagingIE" + /messages while profile pages own "My Profile".
  const isApplicationsSurface = path.includes("/my-submissions")

  const headerTitle =
    title ?? (isApplicationsSurface ? titleT("submissions") : titleT(zone))
  const headerLogoHref =
    logoHref ??
    (isApplicationsSurface
      ? `/${locale}/my-submissions`
      : `/${locale}${zoneRootPath}`)

  const crossZone = useCrossZoneLink()
  const profileHref = crossZone("profile", `/${locale}/my-profile`)
  const dashboardHref = crossZone("dashboard", `/${locale}/my-dashboard`)
  const applicationsHref = crossZone("dashboard", `/${locale}/my-submissions`)
  const messagingHref = crossZone("messages", `/${locale}/messages`)

  const isEnglish = locale === LANG_EN
  const oppositeLocale = isEnglish ? LANG_GA : LANG_EN
  const oppositeLabel = isEnglish ? t("language.irish") : t("language.english")
  const languageHref =
    languageHrefOverride ??
    (path.includes(`/${locale}/`)
      ? path.replace(`/${locale}/`, `/${oppositeLocale}/`)
      : `/${oppositeLocale}`)

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
        <HeaderPrimaryMenu>
          <HeaderMenuItemButton
            icon='menu'
            showItemMode='always'
            onClick={(e) => {
              e.currentTarget.blur()
              setIsDrawerOpen(true)
            }}
          >
            {t("menu")}
          </HeaderMenuItemButton>
        </HeaderPrimaryMenu>
      </HeaderNext>
      <DrawerWrapper
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        position='right'
        closeButtonLabel={t("drawer.close")}
        closeButtonSize='large'
      >
        <DrawerBody>
          <UserMenuDrawer
            name={publicName}
            profileHref={profileHref}
            onSignOut={onSignOut}
            showProfileLink={showApplicationLinks}
          >
            {showApplicationLinks && isZoneEnabled("dashboard") ? (
              <li>
                <ListItem href={dashboardHref} label={t("drawer.dashboard")} />
              </li>
            ) : null}
            {showApplicationLinks &&
            isZoneEnabled("dashboard") &&
            isLeaEnabled() ? (
              <li>
                <ListItem
                  href={applicationsHref}
                  label={t("drawer.submissions")}
                />
              </li>
            ) : null}
            {showApplicationLinks && isZoneEnabled("messages") ? (
              <li>
                <ListItem href={messagingHref} label={t("drawer.messaging")} />
              </li>
            ) : null}
            {zone === "messages" ? (
              <li>
                <ListItem
                  href={`/${locale}/whats-new`}
                  label={t("drawer.whatsNew")}
                />
              </li>
            ) : null}
            <li>
              <ListItem href={languageHref} label={oppositeLabel} />
            </li>
          </UserMenuDrawer>
        </DrawerBody>
      </DrawerWrapper>
    </>
  )
}
