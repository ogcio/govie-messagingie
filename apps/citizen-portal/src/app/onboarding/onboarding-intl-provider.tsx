"use client"

import { useSearchParams } from "next/navigation"
import { NextIntlClientProvider } from "next-intl"
import { Suspense } from "react"
import { HtmlLangScript } from "@/components/html-lang-script"
import { AVAILABLE_LOCALES, DEFAULT_LOCALE } from "@/const"
import { type Locale, messagesMap } from "@/i18n/locale"

/**
 * The /onboarding route lives outside the [locale] segment, so there is no URL
 * locale to drive next-intl. The language is carried in a `?lng=` query param
 * (set by the header language toggle) and falls back to the default locale.
 */
function resolveLocale(value: string | null): Locale {
  return value && AVAILABLE_LOCALES.includes(value as Locale)
    ? (value as Locale)
    : DEFAULT_LOCALE
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
