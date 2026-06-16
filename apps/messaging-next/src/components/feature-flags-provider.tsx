"use client"

import { useAuth } from "@ogcio/sag-client/react"
import {
  FlagProvider,
  type IConfig,
  useFlag,
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

const FeatureFlagNames = {
  UnifiedInbox: "unified-inbox",
} as const

interface AvailableFeatureFlags {
  isUnifiedInboxEnabled: boolean
  isFlagsReady: boolean
}

const defaultFeatureFlags: AvailableFeatureFlags = {
  isUnifiedInboxEnabled: false,
  isFlagsReady: true,
}

const FeatureFlagsContext =
  createContext<AvailableFeatureFlags>(defaultFeatureFlags)

function FeatureFlagsBridge({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const updateContext = useUnleashContext()
  const { isFlagsReady, useFallbackValues } = useFlagsReadyWithFallback()

  useEffect(() => {
    if (user?.sub) {
      void updateContext({ userId: user.sub })
    }
  }, [user?.sub, updateContext])

  const isUnifiedInboxEnabled = useFlag(FeatureFlagNames.UnifiedInbox)

  const value = useMemo<AvailableFeatureFlags>(
    () => ({
      isFlagsReady,
      isUnifiedInboxEnabled: useFallbackValues ? false : isUnifiedInboxEnabled,
    }),
    [isFlagsReady, useFallbackValues, isUnifiedInboxEnabled],
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
