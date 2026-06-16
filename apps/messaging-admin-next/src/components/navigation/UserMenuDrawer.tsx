"use client"

import { Heading, Link, Stack } from "@ogcio/design-system-react"
import { useAnalytics } from "@ogcio/nextjs-analytics"
import { useAuth } from "@ogcio/sag-client/react"
import { UserMenuDrawerContainer } from "@/components/containers"
import { ANALYTICS } from "@/const/analytics"
import { useOrganizationContext } from "@/hooks/use-organization-context"
import { DrawerLink } from "./DrawerLink"
import { OrganizationSelector } from "./OrganizationSelector"

export default function UserMenuDrawer(
  props: React.PropsWithChildren<{
    name: string
    selfHref: string
    selfLabel: string
    signoutLabel: string
  }>,
) {
  const { organizations, currentOrganization, setOrganization } =
    useOrganizationContext()
  const { signOut } = useAuth()
  const analyticsClient = useAnalytics()

  return (
    <UserMenuDrawerContainer>
      <Stack direction='column' gap={12}>
        <div>
          <Heading as='h2' size='md'>
            {props.name}
          </Heading>
          <DrawerLink href={props.selfHref} isBold>
            {props.selfLabel}
          </DrawerLink>
        </div>

        <OrganizationSelector
          title='Department'
          actionTitle='Change department'
          organizations={(organizations || []).map((org) => ({
            name: org.name,
            id: org.id,
          }))}
          defaultOrganization={currentOrganization?.id}
          handleChange={(id) => {
            void setOrganization(id)
          }}
          disabled={false}
        />
        <Stack direction='column' gap={4} hasDivider>
          {props.children}
        </Stack>
      </Stack>

      <Link
        className='gi-w-full footer'
        href='#'
        asButton={{
          size: "large",
        }}
        onClick={(e) => {
          e.preventDefault()
          const eventType = ANALYTICS.adminUser
          analyticsClient.trackEvent({
            event: {
              name: eventType.logout.name,
              category: eventType.category,
              action: eventType.logout.action,
            },
          })
          signOut()
        }}
      >
        {props.signoutLabel}
      </Link>
    </UserMenuDrawerContainer>
  )
}
