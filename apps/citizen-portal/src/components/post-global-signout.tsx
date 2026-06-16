"use client"

import { Spinner } from "@ogcio/design-system-react"
import { useEffect, useRef } from "react"
import { env } from "@/env/env.client"
import { getValidReturnUrl } from "@/util/valid-return-url"

const POST_GLOBAL_SIGNOUT_COOKIE = "postGlobalSignoutUrl"

function readPostGlobalSignoutCookie(): string | null {
  const prefix = `${POST_GLOBAL_SIGNOUT_COOKIE}=`
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim()
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length))
    }
  }
  return null
}

function clearPostGlobalSignoutCookie() {
  document.cookie = `${POST_GLOBAL_SIGNOUT_COOKIE}=; Max-Age=0; path=/`
  const hostname = window.location.hostname
  const parts = hostname.split(".")
  const sharedDomain =
    parts.length >= 3 ? `.${parts.slice(1).join(".")}` : undefined
  if (sharedDomain) {
    document.cookie = `${POST_GLOBAL_SIGNOUT_COOKIE}=; Max-Age=0; path=/; domain=${sharedDomain}`
  }
}

export function PostGlobalSignout() {
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) {
      return
    }
    startedRef.current = true

    const destination =
      getValidReturnUrl(readPostGlobalSignoutCookie()) ??
      env.NEXT_PUBLIC_BASE_URL
    clearPostGlobalSignoutCookie()
    window.location.replace(destination)
  }, [])

  return (
    <output
      aria-label='Redirecting'
      className='gi-flex gi-items-center gi-justify-center'
      style={{ minHeight: "50vh" }}
    >
      <Spinner size='xl' />
    </output>
  )
}
