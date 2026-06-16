"use client"

import { useAuth } from "@ogcio/sag-client/react"
import {
  FlagProvider,
  type IConfig,
  useFlagsStatus,
  useUnleashContext,
} from "@unleash/proxy-client-react"
import { createContext, type ReactNode, useContext, useEffect } from "react"
import { env } from "@/env/env.client"

type AvailableFeatureFlags = Record<string, never>

const defaultFeatureFlags: AvailableFeatureFlags = {}

const FeatureFlagsContext =
  createContext<AvailableFeatureFlags>(defaultFeatureFlags)

function FeatureFlagsBridge({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const updateContext = useUnleashContext()
  const { flagsReady } = useFlagsStatus()

  useEffect(() => {
    if (user?.sub) {
      void updateContext({ userId: user.sub })
    }
  }, [user?.sub, updateContext])

  return (
    <FeatureFlagsContext.Provider value={flagsReady ? {} : {}}>
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
