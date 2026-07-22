"use client"

import { useAuth } from "@ogcio/sag-client/react"
import {
  FlagProvider,
  type IConfig,
  useUnleashContext,
} from "@unleash/proxy-client-react"
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
} from "react"
import { env } from "@/env/env.client"
import { useFlagsReadyWithFallback } from "@/hooks/use-flags-ready-with-fallback"

/**
 * Runtime feature flags via Unleash.
 *
 * Add new flags to `FeatureFlagNames`, `AvailableFeatureFlags`, and the
 * bridge's `useMemo` payload. Consumers read values via `useFeatureFlags()`.
 */
/** Register Unleash flag names here when adding new toggles. */
export const FeatureFlagNames = {} as const

interface AvailableFeatureFlags {
  isFlagsReady: boolean
}

const defaultFeatureFlags: AvailableFeatureFlags = {
  isFlagsReady: true,
}

const FeatureFlagsContext =
  createContext<AvailableFeatureFlags>(defaultFeatureFlags)

function FeatureFlagsBridge({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const updateContext = useUnleashContext()
  const { isFlagsReady } = useFlagsReadyWithFallback()

  useEffect(() => {
    if (user?.sub) {
      void updateContext({ userId: user.sub })
    }
  }, [user?.sub, updateContext])

  const value = useMemo<AvailableFeatureFlags>(
    () => ({
      isFlagsReady,
    }),
    [isFlagsReady],
  )

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  )
}

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const unleashUrl = env.NEXT_PUBLIC_UNLEASH_URL
  const clientKey = env.NEXT_PUBLIC_UNLEASH_CLIENT_KEY

  if (!unleashUrl || !clientKey) {
    return (
      <FeatureFlagsContext.Provider value={defaultFeatureFlags}>
        {children}
      </FeatureFlagsContext.Provider>
    )
  }

  const config: IConfig = {
    url: unleashUrl,
    clientKey,
    appName: env.NEXT_PUBLIC_UNLEASH_APP_NAME,
    refreshInterval: 30,
  }

  return (
    <FlagProvider config={config}>
      <FeatureFlagsBridge>{children}</FeatureFlagsBridge>
    </FlagProvider>
  )
}

export function useFeatureFlags(): AvailableFeatureFlags {
  return useContext(FeatureFlagsContext)
}
