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

/**
 * Unified feature-flags provider across all zones.
 *
 * Merged from the messages and profile zones in Phase B2. Both flag
 * definitions live here; consumers read whichever they care about via
 * `useFeatureFlags()`. New flags get added to `FeatureFlagNames` plus
 * `AvailableFeatureFlags` plus the bridge's `useMemo` payload.
 */
const FeatureFlagNames = {
  /** Messages zone — gates the unified inbox UI rollout. */
  UnifiedInbox: "unified-inbox",
  /** Profile zone — gates the "export my data" lifecycle action. */
  ExportUser: "export-user",
} as const

interface AvailableFeatureFlags {
  isFlagsReady: boolean
  isUnifiedInboxEnabled: boolean
  isUserExportEnabled: boolean
}

const defaultFeatureFlags: AvailableFeatureFlags = {
  isFlagsReady: true,
  isUnifiedInboxEnabled: false,
  isUserExportEnabled: false,
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
  const isUserExportEnabled = useFlag(FeatureFlagNames.ExportUser)

  const value = useMemo<AvailableFeatureFlags>(
    () => ({
      isFlagsReady,
      isUnifiedInboxEnabled: useFallbackValues ? false : isUnifiedInboxEnabled,
      isUserExportEnabled: useFallbackValues ? false : isUserExportEnabled,
    }),
    [isFlagsReady, useFallbackValues, isUnifiedInboxEnabled, isUserExportEnabled],
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
