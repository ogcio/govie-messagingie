"use client"

import { useEffect, useState } from "react"

/**
 * Returns true after the browser has painted and the main thread is idle.
 * Use to defer non-critical providers and assets during initial load so
 * loading indicators stay responsive.
 */
export function useIdleMount(timeoutMs = 2_000): boolean {
  const [ready, setReady] = useState(
    () => typeof process !== "undefined" && process.env.NODE_ENV === "test",
  )

  useEffect(() => {
    let cancelled = false

    const markReady = () => {
      if (!cancelled) {
        setReady(true)
      }
    }

    // Wait for paint, then yield to idle work before mounting heavy trees.
    const afterPaint = () => {
      if (typeof requestIdleCallback === "function") {
        const idleId = requestIdleCallback(markReady, { timeout: timeoutMs })
        return () => cancelIdleCallback(idleId)
      }

      const timeoutId = window.setTimeout(markReady, 0)
      return () => window.clearTimeout(timeoutId)
    }

    const frameId = requestAnimationFrame(() => {
      cleanup = afterPaint()
    })

    let cleanup: (() => void) | undefined

    return () => {
      cancelled = true
      cancelAnimationFrame(frameId)
      cleanup?.()
    }
  }, [timeoutMs])

  return ready
}
