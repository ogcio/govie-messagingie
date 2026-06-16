"use client"

import { SideNav, SideNavItem } from "@ogcio/design-system-react"
import { usePathname, useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"

export default () => {
  const locale = useLocale()
  const t2 = useTranslations("SideMenu")
  const path = usePathname()

  const router = useRouter()

  const sendAMessageLoc = `/${locale}/send-a-message`
  const messageTemplatesLoc = `/${locale}/message-templates`
  const providersLoc = `/${locale}/providers`
  const eventsLoc = `/${locale}/message-events`
  const helpLoc = `/${locale}/help`

  const navPaths = [
    sendAMessageLoc,
    messageTemplatesLoc,
    providersLoc,
    eventsLoc,
    helpLoc,
  ]

  const currentSection =
    navPaths.find((basePath) => path.startsWith(basePath)) || ""

  const handleNavChange = (value: string) => router.push(value)

  return (
    <SideNav
      value={currentSection}
      className='side-nav'
      onChange={handleNavChange}
    >
      <SideNavItem value={sendAMessageLoc} label={t2("sendMessage")} primary />
      <SideNavItem
        value={messageTemplatesLoc}
        label={t2("templates")}
        primary
      />
      <SideNavItem value={providersLoc} label={t2("providers")} primary />
      <SideNavItem value={eventsLoc} label={t2("events")} primary />
      <SideNavItem value={helpLoc} label={t2("help")} primary />
    </SideNav>
  )
}
