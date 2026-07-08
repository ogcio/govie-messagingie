"use client"

import { useEffect } from "react"
import type { AVAILABLE_LOCALES } from "@/const"
import { writeLocaleCookie } from "@/util/locale-cookie"

export function HtmlLangScript({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale
    // Persist the locale the user is actually viewing so bare-path and
    // cross-app landings can restore it instead of falling back to the
    // browser language.
    writeLocaleCookie(locale as (typeof AVAILABLE_LOCALES)[number])
  }, [locale])

  return null
}
