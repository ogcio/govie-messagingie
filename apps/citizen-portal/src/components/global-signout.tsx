"use client"

import { getEnv } from "@citizen-portal/shared"
import { Paragraph, Spinner, Stack } from "@ogcio/design-system-react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Suspense, useEffect, useRef, useState } from "react"
import { env } from "@/env/env.client"
import { getValidReturnUrl } from "@/util/valid-return-url"

const IFRAME_TIMEOUT_MS = 20_000
const MIN_DELAY_MS = 3000
const POST_GLOBAL_SIGNOUT_COOKIE = "postGlobalSignoutUrl"
const LOGTO_SOCIAL_CONNECTOR_ID_COOKIE_NAME = "connectorsToShow"

function trimTrailingSlash(url: string) {
  return url.replace(/\/$/, "")
}

function buildLegacyApplicationSignoutUrl(baseUrl: string) {
  return `${trimTrailingSlash(baseUrl)}/application-signout`
}

function buildNewApplicationSignoutUrl(baseUrl: string) {
  return `${trimTrailingSlash(baseUrl)}/api/application-signout`
}

function setPostGlobalSignoutCookie(postRedirectUri: string) {
  document.cookie = `${POST_GLOBAL_SIGNOUT_COOKIE}=${encodeURIComponent(postRedirectUri)}; path=/; max-age=300`
}

function clearConnectorsToShowCookie() {
  const hostname = window.location.hostname
  const parts = hostname.split(".")
  const sharedDomain =
    parts.length >= 3 ? `.${parts.slice(1).join(".")}` : undefined

  document.cookie = `${LOGTO_SOCIAL_CONNECTOR_ID_COOKIE_NAME}=; Max-Age=0; path=/`
  if (sharedDomain) {
    document.cookie = `${LOGTO_SOCIAL_CONNECTOR_ID_COOKIE_NAME}=; Max-Age=0; path=/; domain=${sharedDomain}`
  }
}

function postGatewaySignOut(
  gatewayUrl: string,
  app: string,
  postLogoutRedirectUri?: string,
) {
  const params = new URLSearchParams({ app })
  if (postLogoutRedirectUri) {
    params.set("postLogoutRedirectUri", postLogoutRedirectUri)
  }
  const form = document.createElement("form")
  form.method = "POST"
  form.action = `${trimTrailingSlash(gatewayUrl)}/auth/sign-out?${params.toString()}`
  document.body.appendChild(form)
  form.submit()
}

function buildIframeUrlList(role: string | null) {
  const urls: string[] = []

  if (role === "citizen" && env.NEXT_PUBLIC_MYGOVID_END_SESSION_URL) {
    urls.push(env.NEXT_PUBLIC_MYGOVID_END_SESSION_URL)
  }

  // Sibling-zone hosts (messages / dashboard) and the gateway URL come
  // from the shared citizen-portal env. Admin URLs + non-zone services
  // (payments / journey-builder) stay zone-local — they're not part of
  // the citizen-portal multi-zone deployment.
  const { hosts, sagUrl } = getEnv()

  const legacyBases = [
    hosts.dashboard,
    env.NEXT_PUBLIC_DASHBOARD_ADMIN_URL,
    env.NEXT_PUBLIC_PAYMENTS_URL,
    env.NEXT_PUBLIC_JOURNEY_URL,
  ]
  for (const base of legacyBases) {
    urls.push(buildLegacyApplicationSignoutUrl(base))
  }

  const newBases = [
    env.NEXT_PUBLIC_BASE_URL,
    env.NEXT_PUBLIC_PROFILE_ADMIN_URL,
    hosts.messages,
    env.NEXT_PUBLIC_MESSAGING_ADMIN_URL,
  ]
  for (const base of newBases) {
    urls.push(buildNewApplicationSignoutUrl(base))
  }

  urls.push(`${trimTrailingSlash(sagUrl)}/auth/clear-session`)

  const seen = new Set<string>()
  return urls.filter((u) => {
    if (seen.has(u)) {
      return false
    }
    seen.add(u)
    return true
  })
}

function GlobalSignoutInner() {
  const t = useTranslations("globalSignout")
  const searchParams = useSearchParams()
  const postRedirectUri = getValidReturnUrl(
    searchParams.get("postRedirectUri") ??
      searchParams.get("post_logout_redirect_uri"),
  )
  const sagSignout = searchParams.get("sagSignout") === "true"
  const role = searchParams.get("role")

  const [iframesDone, setIframesDone] = useState(false)
  const [minDelayDone, setMinDelayDone] = useState(false)
  const finishedRef = useRef(false)

  useEffect(() => {
    clearConnectorsToShowCookie()
    if (!sagSignout && postRedirectUri) {
      setPostGlobalSignoutCookie(postRedirectUri)
    }
  }, [postRedirectUri, sagSignout])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMinDelayDone(true)
    }, MIN_DELAY_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    const iframeUrls = buildIframeUrlList(role)
    const container = document.createElement("div")
    container.setAttribute("aria-hidden", "true")
    container.style.cssText =
      "position:absolute;width:0;height:0;overflow:hidden"
    document.body.appendChild(container)

    if (iframeUrls.length === 0) {
      setIframesDone(true)
      return () => {
        container.remove()
      }
    }

    let loaded = 0
    const total = iframeUrls.length
    const markOne = () => {
      loaded += 1
      if (loaded >= total) {
        setIframesDone(true)
      }
    }

    for (const src of iframeUrls) {
      const iframe = document.createElement("iframe")
      iframe.title = "sign-out"
      iframe.style.cssText = "width:0;height:0;border:0"
      iframe.onload = () => {
        markOne()
      }
      iframe.onerror = () => {
        markOne()
      }
      iframe.src = src
      container.appendChild(iframe)
    }

    const timeoutId = window.setTimeout(() => {
      setIframesDone(true)
    }, IFRAME_TIMEOUT_MS)

    return () => {
      window.clearTimeout(timeoutId)
      container.remove()
    }
  }, [role])

  useEffect(() => {
    if (!iframesDone || !minDelayDone || finishedRef.current) {
      return
    }
    finishedRef.current = true

    if (sagSignout && postRedirectUri) {
      window.location.href = postRedirectUri
      return
    }

    const fallbackRedirect = postRedirectUri ?? env.NEXT_PUBLIC_BASE_URL
    setPostGlobalSignoutCookie(fallbackRedirect)

    const postGlobalSignoutUrl = new URL(
      "/post-global-signout",
      env.NEXT_PUBLIC_BASE_URL,
    ).toString()

    // SAG gateway URL + app name flow through the shared env so all
    // three citizen-portal zones agree on the gateway URL and on the
    // SAG app identifier used for the signout form. Same pattern as
    // ClientShell#handleSessionExpired.
    const { sagUrl, sagAppName } = getEnv()
    postGatewaySignOut(sagUrl, sagAppName, postGlobalSignoutUrl)
  }, [iframesDone, minDelayDone, postRedirectUri, sagSignout])

  return (
    <output
      aria-label={t("loggingOut")}
      className='gi-flex gi-flex-col gi-items-center gi-justify-center gi-gap-6'
      style={{ minHeight: "50vh" }}
    >
      <Spinner size='xl' />
      <Stack direction='column' gap={2} itemsAlignment='center'>
        <Paragraph>{t("loggingOut")}</Paragraph>
        <Paragraph>{t("pleaseWait")}</Paragraph>
      </Stack>
    </output>
  )
}

export function GlobalSignout() {
  return (
    <Suspense
      fallback={
        <output
          aria-label='Loading'
          className='gi-flex gi-items-center gi-justify-center'
          style={{ minHeight: "50vh" }}
        >
          <Spinner size='xl' />
        </output>
      }
    >
      <GlobalSignoutInner />
    </Suspense>
  )
}
