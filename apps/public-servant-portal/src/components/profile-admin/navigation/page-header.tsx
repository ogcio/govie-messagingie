"use client"

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
} from "@ogcio/design-system-react"
import { LogoHarpWhite, LogoWhite } from "@ogcio/design-system-react/logos"
import { usePathname } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { LANG_EN, LANG_GA } from "@/const"
import { env } from "@/env/env.client"
import { useOrganizationContext } from "@/hooks/profile-admin/use-organization-context"
import { DrawerLink } from "./drawer-link"
import { UserMenuDrawer } from "./user-menu-drawer"

export function PageHeader({
  publicName,
  onSignOut,
}: {
  publicName: string
  onSignOut: () => void
}) {
  const locale = useLocale()
  const path = usePathname()
  const t = useTranslations("navigation.header")
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const { currentOrganization } = useOrganizationContext()
  const headerTitle = currentOrganization?.name
    ? t("titleWithOrg", { organization: currentOrganization.name })
    : t("title")

  const { NEXT_PUBLIC_MESSAGING_ADMIN_URL } = env

  const isEnglish = locale === LANG_EN
  const oppositeLocale = isEnglish ? LANG_GA : LANG_EN
  const oppositeLabel = isEnglish ? t("language.irish") : t("language.english")
  const languageHref = path.replace(`/${locale}/`, `/${oppositeLocale}/`)

  return (
    <>
      <HeaderNext variant='default'>
        <HeaderLogo>
          <a href={`/${locale}`} aria-label={t("title")}>
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
            profileHref={`/${locale}/my-profile`}
            onSignOut={onSignOut}
          >
            <DrawerLink
              bold
              href={`${NEXT_PUBLIC_MESSAGING_ADMIN_URL}/${locale}`}
            >
              {t("drawer.messaging")}
            </DrawerLink>
            <DrawerLink bold href={`/${locale}/service-users`}>
              {t("drawer.serviceUsers")}
            </DrawerLink>
            <DrawerLink href={languageHref}>{oppositeLabel}</DrawerLink>
          </UserMenuDrawer>
        </DrawerBody>
      </DrawerWrapper>
    </>
  )
}
