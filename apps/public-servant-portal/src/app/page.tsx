"use client"

import { useEffect } from "react"
import { DEFAULT_LOCALE } from "@/const"
import { useLocalePreference } from "@/hooks/use-locale-preference"

export default function RootPage() {
  const { locale, isReady } = useLocalePreference()

  useEffect(() => {
    if (isReady) {
      window.location.replace(`/${locale}/send-a-message`)
    }
  }, [locale, isReady])

  return (
    <noscript>
      <p>
        <a href={`/${DEFAULT_LOCALE}/send-a-message`}>Continue to admin</a>
      </p>
    </noscript>
  )
}
