"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"
import { DEFAULT_LOCALE } from "@/const"
import { useLocalePreference } from "@/hooks/use-locale-preference"

/**
 * No-locale entry point that detects the browser's locale preference
 * and redirects to `/{locale}/wrong-login-method-error`. The gateway
 * sometimes lands users here without a locale prefix — picking the
 * right locale on first render is friendlier than always defaulting to
 * `en`.
 */
function Redirect() {
  const { locale, isReady } = useLocalePreference()
  const searchParams = useSearchParams()
  const returnUrl = searchParams.get("returnUrl")

  useEffect(() => {
    if (isReady) {
      const target = new URL(
        `/${locale}/wrong-login-method-error`,
        window.location.origin,
      )
      if (returnUrl) {
        target.searchParams.set("returnUrl", returnUrl)
      }
      window.location.replace(target.toString())
    }
  }, [locale, isReady, returnUrl])

  return (
    <noscript>
      <p>
        <a
          href={`/${DEFAULT_LOCALE}/wrong-login-method-error${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ""}`}
        >
          Continue
        </a>
      </p>
    </noscript>
  )
}

export default function WrongLoginMethodRedirect() {
  return (
    <Suspense>
      <Redirect />
    </Suspense>
  )
}
