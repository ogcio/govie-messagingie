"use client"

import { useEffect } from "react"

export function HtmlLangScript({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return null
}
