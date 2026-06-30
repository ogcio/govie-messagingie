"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"
import { DEFAULT_LOCALE } from "@/const"
import { useLocalePreference } from "@/hooks/use-locale-preference"

/**
 * No-locale entry point for the global signout flow.
 *
 * Journey Builder, Payments, and the legacy profile authorisation package
 * redirect here as `/global-signout?...` (no locale prefix). The actual
 * signout page lives at `/{locale}/global-signout`; legacy profile used
 * next-intl middleware to add the prefix automatically, but the static
 * export cannot — this redirect preserves backward compatibility.
 */
function Redirect() {
  const { locale, isReady } = useLocalePreference()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!isReady) return

    const target = new URL(
      `/${locale}/global-signout`,
      window.location.origin,
    )

    searchParams.forEach((value, key) => {
      target.searchParams.set(key, value)
    })

    const legacyPostRedirectUrl = searchParams.get("postRedirectUrl")
    if (legacyPostRedirectUrl && !target.searchParams.has("postRedirectUri")) {
      target.searchParams.set("postRedirectUri", legacyPostRedirectUrl)
    }

    window.location.replace(target.toString())
  }, [locale, isReady, searchParams])

  const query = searchParams.toString()
  const fallbackHref = `/${DEFAULT_LOCALE}/global-signout${query ? `?${query}` : ""}`

  return (
    <noscript>
      <p>
        <a href={fallbackHref}>Continue</a>
      </p>
    </noscript>
  )
}

export default function GlobalSignoutRedirect() {
  return (
    <Suspense>
      <Redirect />
    </Suspense>
  )
}
