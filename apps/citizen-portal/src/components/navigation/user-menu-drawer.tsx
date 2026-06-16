"use client"

import { Button, Heading, Stack } from "@ogcio/design-system-react"
import { useTranslations } from "next-intl"
import type { PropsWithChildren } from "react"
import { DrawerLink } from "./drawer-link"

/**
 * Drawer that opens off the page header on small screens / always-shown
 * mode. Unified from messages and profile zones in Phase B2.
 *
 * Profile's signature wins: the `showProfileLink` prop covers the
 * messages-zone use case (always visible: profile is the canonical
 * "view my profile" target) while still letting the profile zone hide
 * the link when the active route IS my-profile (driven by
 * `useShowApplicationLinks()`).
 *
 * Translation namespace `navigation.userMenu.{viewMyProfile, logout}`
 * replaces messages' `navigation.header.drawer.{profile, logout}` —
 * see the catalogue restructure in the same commit.
 */
export function UserMenuDrawer({
  name,
  profileHref,
  onSignOut,
  showProfileLink = true,
  children,
}: PropsWithChildren<{
  name: string
  profileHref: string
  onSignOut: () => void
  showProfileLink?: boolean
}>) {
  const t = useTranslations("navigation.userMenu")

  return (
    <div className='user-drawer-menu-container'>
      <Stack direction='column' gap={12}>
        <div>
          <Heading as='h2' size='md'>
            {name}
          </Heading>
          {showProfileLink ? (
            <DrawerLink href={profileHref} bold>
              {t("viewMyProfile")}
            </DrawerLink>
          ) : null}
        </div>
        <Stack direction='column' gap={4} hasDivider>
          {children as React.ReactNode}
        </Stack>
      </Stack>

      <Button className='footer' size='large' onClick={onSignOut}>
        {t("logout")}
      </Button>
    </div>
  )
}
