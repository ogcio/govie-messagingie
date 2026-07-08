"use client"

import { useSearchParams } from "next/navigation"
import { NextIntlClientProvider } from "next-intl"
import { Suspense } from "react"
import { HtmlLangScript } from "@/components/html-lang-script"
import { AVAILABLE_LOCALES, DEFAULT_LOCALE } from "@/const"
import { type Locale, messagesMap } from "@/i18n/locale"
import { readLocaleCookie } from "@/util/locale-cookie"

/**
 * The /onboarding route lives outside the [locale] segment, so there is no URL
 * locale to drive next-intl. The language is carried in a `?lng=` query param
 * (set by the header language toggle). When absent, we honour the persisted
 * `NEXT_LOCALE` cookie before falling back to the default locale, so a choice
 * made elsewhere carries into onboarding.
 */
function resolveLocale(value: string | null): Locale {
  if (value && AVAILABLE_LOCALES.includes(value as Locale)) {
    return value as Locale
  }
  return readLocaleCookie() ?? DEFAULT_LOCALE
}

function OnboardingIntlProviderInner({
  children,
}: {
  children: React.ReactNode
}) {
  const searchParams = useSearchParams()
  const locale = resolveLocale(searchParams.get("lng"))

  return (
    <NextIntlClientProvider locale={locale} messages={messagesMap[locale]}>
      <HtmlLangScript locale={locale} />
      {children}
    </NextIntlClientProvider>
  )
}

export function OnboardingIntlProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={null}>
      <OnboardingIntlProviderInner>{children}</OnboardingIntlProviderInner>
    </Suspense>
  )
}
