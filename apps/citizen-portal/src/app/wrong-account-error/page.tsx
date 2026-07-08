"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"
import { DEFAULT_LOCALE } from "@/const"
import { useLocalePreference } from "@/hooks/use-locale-preference"

/**
 * No-locale entry point that detects the browser's locale preference
 * and redirects to `/{locale}/wrong-account-error`. Journey Builder and
 * Payments redirect here as `/wrong-account-error?returnUrl=...` (no
 * locale prefix); the static export cannot add the prefix automatically.
 */
function Redirect() {
  const { locale, isReady } = useLocalePreference()
  const searchParams = useSearchParams()
  const returnUrl = searchParams.get("returnUrl")

  useEffect(() => {
    if (isReady) {
      const target = new URL(
        `/${locale}/wrong-account-error`,
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
          href={`/${DEFAULT_LOCALE}/wrong-account-error${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ""}`}
        >
          Continue
        </a>
      </p>
    </noscript>
  )
}

export default function WrongAccountErrorRedirect() {
  return (
    <Suspense>
      <Redirect />
    </Suspense>
  )
}
