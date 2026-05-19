"use client"

import {
  AnnouncementsModal,
  AnnouncementsProvider,
} from "@ogcio/announcements/react"
import type { ConsentStatementLanguages } from "@ogcio/consent"
import { useConsent } from "@ogcio/consent/react"
import type * as React from "react"
import { messagesMap } from "@/i18n/locale"

const MESSAGING_ANNOUNCEMENTS_APPLICATION_ID = "messaging" as const

type LanguageSwitcherConfig = {
  translations: {
    english: string
    irish: string
  }
}

type AnnouncementsFlowProps = {
  children: React.ReactNode
  locale: ConsentStatementLanguages
  languageSwitcher: LanguageSwitcherConfig
  onLocaleChange: (locale: ConsentStatementLanguages) => void
}

type AnnouncementsProviderChildren = React.ComponentProps<
  typeof AnnouncementsProvider
>["children"]

export function AnnouncementsFlow({
  children,
  locale,
  languageSwitcher,
  onLocaleChange,
}: AnnouncementsFlowProps) {
  const { isLoading: isConsentLoading } = useConsent()
  const providerChildren = (
    <>
      <AnnouncementsModal />
      {children}
    </>
  ) as AnnouncementsProviderChildren

  return (
    <AnnouncementsProvider
      applicationId={MESSAGING_ANNOUNCEMENTS_APPLICATION_ID}
      locale={locale}
      isAnnouncementsEnabled={!isConsentLoading}
      onLocaleChange={onLocaleChange}
      languageSwitcher={languageSwitcher}
      showToastOnSuccess={false}
      modalHeader={{
        en: {
          title: messagesMap.en.announcements.modalHeader.title,
          description: messagesMap.en.announcements.modalHeader.description,
        },
        ga: {
          title: messagesMap.ga.announcements.modalHeader.title,
          description: messagesMap.ga.announcements.modalHeader.description,
        },
      }}
    >
      {providerChildren}
    </AnnouncementsProvider>
  )
}
