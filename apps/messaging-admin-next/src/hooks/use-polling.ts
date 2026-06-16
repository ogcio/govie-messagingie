"use client"

import { useCallback, useEffect, useRef } from "react"

export function usePolling(
  conditionFn: () => Promise<boolean>,
  asyncFn: () => Promise<void>,
  interval: number,
) {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const isPollingRef = useRef(false)

  const poll = useCallback(async () => {
    if (isPollingRef.current) {
      return
    }

    isPollingRef.current = true

    const loop = async () => {
      try {
        const shouldContinue = await conditionFn()
        if (shouldContinue) {
          await asyncFn()
          timeoutRef.current = setTimeout(loop, interval)
        }
      } catch {}
    }

    loop()
  }, [conditionFn, asyncFn, interval])

  useEffect(() => {
    poll()
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      isPollingRef.current = false
    }
  }, [poll])
}
