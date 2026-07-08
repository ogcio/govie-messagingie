"use client"

import { usePathname } from "next/navigation"
import { useLocale } from "next-intl"
import { AVAILABLE_LOCALES, DEFAULT_LOCALE } from "@/const"
import { readLocaleCookie } from "@/util/locale-cookie"

type Locale = (typeof AVAILABLE_LOCALES)[number]

export function localeFromPathname(pathname: string): Locale | null {
  const segment = pathname.split("/").filter(Boolean)[0]
  return AVAILABLE_LOCALES.includes(segment as Locale)
    ? (segment as Locale)
    : null
}

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
