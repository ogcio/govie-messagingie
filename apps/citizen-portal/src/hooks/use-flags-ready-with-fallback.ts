import { useFlagsStatus } from "@unleash/proxy-client-react"
import { useEffect, useState } from "react"

/** Max wait before treating Unleash as unavailable and using safe defaults. */
export const FLAGS_READY_TIMEOUT_MS = 5_000

export interface FlagsReadyState {
  isFlagsReady: boolean
  /** Unleash never connected — all flags must evaluate to false. */
  useFallbackValues: boolean
}

export function useFlagsReadyWithFallback(): FlagsReadyState {
  const { flagsReady, flagsError } = useFlagsStatus()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (flagsReady) {
      setTimedOut(false)
      return
    }

    const id = setTimeout(() => setTimedOut(true), FLAGS_READY_TIMEOUT_MS)
    return () => clearTimeout(id)
  }, [flagsReady])

  if (flagsReady) {
    return { isFlagsReady: true, useFallbackValues: false }
  }

  if (flagsError || timedOut) {
    return { isFlagsReady: true, useFallbackValues: true }
  }

  return { isFlagsReady: false, useFallbackValues: false }
}
