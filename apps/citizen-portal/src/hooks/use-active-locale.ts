"use client"

import { usePathname } from "next/navigation"
import { useLocale } from "next-intl"
import { AVAILABLE_LOCALES, DEFAULT_LOCALE } from "@/const"
import { readLocaleCookie } from "@/util/locale-cookie"

type Locale = (typeof AVAILABLE_LOCALES)[number]

/** Read a supported locale from the first URL path segment, if present. */
export function localeFromPathname(pathname: string): Locale | null {
  const segment = pathname.split("/").filter(Boolean)[0]
  return AVAILABLE_LOCALES.includes(segment as Locale)
    ? (segment as Locale)
    : null
}

/**
 * Locale for navigation chrome (cross-app menu links, language toggle).
 *
 * On `[locale]` routes the URL segment is authoritative — `useLocale()`
 * can lag behind or default to `en` on static-export pages when the
 * provider is not seeded with an explicit locale. Fall back to the
 * persisted cookie, then next-intl context.
 */
export function useActiveLocale(): Locale {
  const pathname = usePathname()
  const intlLocale = useLocale()
  return (
    localeFromPathname(pathname) ??
    readLocaleCookie() ??
    (AVAILABLE_LOCALES.includes(intlLocale as Locale)
      ? (intlLocale as Locale)
      : DEFAULT_LOCALE)
  )
}
