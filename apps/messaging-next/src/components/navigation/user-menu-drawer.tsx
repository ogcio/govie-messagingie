"use client"

import { Button, Heading, Stack } from "@ogcio/design-system-react"
import { useTranslations } from "next-intl"
import type { PropsWithChildren } from "react"
import { DrawerLink } from "./drawer-link"

export function UserMenuDrawer({
  name,
  profileHref,
  onSignOut,
  children,
}: PropsWithChildren<{
  name: string
  profileHref: string
  onSignOut: () => void
}>) {
  const t = useTranslations("navigation.header.drawer")

  return (
    <div className='user-drawer-menu-container'>
      <Stack direction='column' gap={12}>
        <div>
          <Heading as='h2' size='md'>
            {name}
          </Heading>
          <DrawerLink href={profileHref} bold>
            {t("profile")}
          </DrawerLink>
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
