"use client"

import { Button, Heading, Stack } from "@ogcio/design-system-react"
import { useTranslations } from "next-intl"
import type { PropsWithChildren } from "react"
import { useOrganizationContext } from "@/hooks/profile-admin/use-organization-context"
import { DrawerLink } from "./drawer-link"
import { OrganizationSelector } from "./organization-selector"

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
  const t = useTranslations("navigation.userMenu")
  const { organizations, currentOrganization, setOrganization } =
    useOrganizationContext()

  return (
    <div className='user-drawer-menu-container'>
      <Stack direction='column' gap={12}>
        <div>
          <Heading as='h2' size='md'>
            {name}
          </Heading>
          <DrawerLink href={profileHref} bold>
            {t("viewMyProfile")}
          </DrawerLink>
        </div>
        {organizations.length > 1 && (
          <OrganizationSelector
            title={t("organization.title")}
            organizations={organizations.map((o) => ({
              id: o.id,
              name: o.name,
            }))}
            defaultOrganization={currentOrganization?.id}
            onChange={(id) => {
              void setOrganization(id)
            }}
          />
        )}
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
