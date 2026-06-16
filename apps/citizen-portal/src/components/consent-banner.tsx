"use client"

import { FORCE_CONSENT_PARAM, useConsent } from "@ogcio/consent/react"
import { Alert, Link } from "@ogcio/design-system-react"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

export function ConsentBanner() {
  const t = useTranslations("consent")
  const { isOptedOut } = useConsent()
  const pathname = usePathname()
  const [consentModalUrl, setConsentModalUrl] = useState("")

  useEffect(() => {
    const url = new URL(pathname, window.location.origin)
    url.searchParams.set(FORCE_CONSENT_PARAM, "1")
    setConsentModalUrl(url.href)
  }, [pathname])

  if (!isOptedOut || !consentModalUrl) {
    return null
  }

  return (
    <div className='gi-mb-4'>
      <Alert
        variant='info'
        title={
          t.rich("banner", {
            link: (chunks) => <Link href={consentModalUrl}>{chunks}</Link>,
          }) as string
        }
      />
    </div>
  )
}
