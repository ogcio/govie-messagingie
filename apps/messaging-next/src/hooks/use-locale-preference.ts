"use client"

import { match } from "@formatjs/intl-localematcher"
import { useCallback, useEffect, useState } from "react"
import { AVAILABLE_LOCALES, DEFAULT_LOCALE } from "@/const"

type Locale = (typeof AVAILABLE_LOCALES)[number]

/**
 * Finds the best matching supported locale from a list of browser language preferences
 * using the Unicode CLDR locale matching algorithm (BCP 47).
 */
export function matchLocale(browserLanguages: readonly string[]): Locale {
  return match(
    Array.from(browserLanguages),
    Array.from(AVAILABLE_LOCALES),
    DEFAULT_LOCALE,
  ) as Locale
}

/**
 * Hook that detects the user's preferred locale from browser settings.
 *
 * Uses `navigator.languages` (ordered preference list) with fallback to
 * `navigator.language`, and listens for runtime language changes.
 *
 * Returns `{ locale, isReady }` where `isReady` becomes true once the
 * browser preference has been read (avoids acting on the server-side default).
 */
export function useLocalePreference() {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE)
  const [isReady, setIsReady] = useState(false)

  const detect = useCallback(() => {
    const languages = navigator.languages?.length
      ? navigator.languages
      : [navigator.language]
    setLocale(matchLocale(languages))
    setIsReady(true)
  }, [])

  useEffect(() => {
    detect()
    window.addEventListener("languagechange", detect)
    return () => window.removeEventListener("languagechange", detect)
  }, [detect])

  return { locale, isReady }
}
