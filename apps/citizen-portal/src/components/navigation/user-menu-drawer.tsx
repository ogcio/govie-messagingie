"use client"

import { Button, Heading, Link } from "@ogcio/design-system-react"
import { useTranslations } from "next-intl"
import type { PropsWithChildren } from "react"

/**
 * Drawer that opens off the page header on small screens / always-shown
 * mode. Aligns with the DS drawer menu pattern (AB#41657) by rendering
 * nav entries as `ListItem` inside a `<ul>` — the same shape the DS
 * `DrawerMenuExample` uses for secondary items. `ListItem` owns the
 * visited / hover styles (`gi-list-item`), so items no longer pick up
 * the browser's purple `:visited` colour.
 *
 * Items are plain (not `bold`): in the DS example `bold` marks primary
 * items, the expandable ones with a chevron. Ours are all flat links,
 * i.e. DS secondary items.
 *
 * The name and its profile link sit above the list rather than in it —
 * the link belongs to the name ("view MY profile"), so it reads as a
 * caption under the heading instead of a peer of the nav items. It
 * still has to *look* like those items though, hence `noColor` +
 * `noUnderline` + `sm`: inherited text colour (which also opts the
 * link out of DS's blue and the purple `:visited`, the bug this ticket
 * started from) with the underline only on hover, same as `ListItem`.
 *
 * The `showProfileLink` prop covers the messages-zone use case (always
 * visible: profile is the canonical "view my profile" target) while
 * still letting the profile zone hide the link when the active route
 * IS my-profile (driven by `useShowApplicationLinks()`).
 *
 * Children are expected to be `<li>` wrappers around further
 * `ListItem`s (see `page-header.tsx`).
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
      <Heading as='h2' size='lg'>
        {name}
      </Heading>
      {showProfileLink ? (
        <Link href={profileHref} noColor noUnderline size='sm'>
          {t("viewMyProfile")}
        </Link>
      ) : null}
      <ul className='gi-mt-4'>{children}</ul>

      <Button className='footer' size='large' onClick={onSignOut}>
        {t("logout")}
      </Button>
    </div>
  )
}
