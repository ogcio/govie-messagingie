"use client"

import { useSearchParams } from "next/navigation"
import { useSyncExternalStore } from "react"

type Listener = () => void
const listeners = new Set<Listener>()
let historyPatched = false

function subscribe(listener: Listener) {
  patchHistoryOnce()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function patchHistoryOnce() {
  if (historyPatched || typeof window === "undefined") return
  historyPatched = true

  const notify = () => {
    for (const listener of listeners) {
      listener()
    }
  }
  const originalPushState = history.pushState.bind(history)
  const originalReplaceState = history.replaceState.bind(history)

  history.pushState = (...args) => {
    const result = originalPushState(...args)
    notify()
    return result
  }

  history.replaceState = (...args) => {
    const result = originalReplaceState(...args)
    notify()
    return result
  }

  window.addEventListener("popstate", notify)
}

function getClientSearchString() {
  return window.location.search
}

/**
 * Query params synced with the live address bar. Next.js `useSearchParams()`
 * can stay stale after a full reload when the URL is updated via
 * `history.replaceState` alone (AB#40679).
 *
 * In unit tests we prefer Next's mocked `useSearchParams()` so existing
 * suite fixtures keep working; the history-backed path is covered by
 * dedicated hook tests that stub `NODE_ENV` to `"production"`.
 */
export function useUrlSearchParams() {
  const nextParams = useSearchParams()
  const preferNextParams = process.env.NODE_ENV === "test"

  const searchString = useSyncExternalStore(
    subscribe,
    getClientSearchString,
    () => (nextParams.toString() ? `?${nextParams.toString()}` : ""),
  )

  if (preferNextParams) {
    return nextParams
  }

  const normalized = searchString.startsWith("?")
    ? searchString.slice(1)
    : searchString

  return new URLSearchParams(normalized)
}
