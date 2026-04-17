"use client"

import { useEffect } from "react"
import { DEFAULT_LOCALE } from "@/const"
import { useLocalePreference } from "@/hooks/use-locale-preference"

/**
 * Root redirect page.
 *
 * Detects the user's browser locale preference and redirects to the
 * best-matching localised messages page (e.g. /en/messages or /ga/messages).
 *
 * Uses `window.location.replace` so the redirect entry is not kept in the
 * browser history — pressing "back" won't loop back here.
 *
 * For users with JavaScript disabled, a plain link to the default locale
 * is rendered as a fallback.
 */
export default function RootPage() {
  const { locale, isReady } = useLocalePreference()

  useEffect(() => {
    if (isReady) {
      window.location.replace(`/${locale}/messages`)
    }
  }, [locale, isReady])

  return (
    <noscript>
      <p>
        <a href={`/${DEFAULT_LOCALE}/messages`}>Continue to messages</a>
      </p>
    </noscript>
  )
}
