"use client"

import dynamic from "next/dynamic"
import { useFeatureFlags } from "@/components/feature-flags-provider"

const OldMessagesPage = dynamic(
  () => import("./messages").then((mod) => mod.MessagesPage),
  { ssr: false },
)

const NewUnifiedInboxPage = dynamic(
  () => import("./unified-inbox").then((mod) => mod.UnifiedInboxPage),
  { ssr: false },
)

export function MessagesPageClient() {
  const { isUnifiedInboxEnabled } = useFeatureFlags()

  if (isUnifiedInboxEnabled) {
    return <NewUnifiedInboxPage />
  }

  return <OldMessagesPage />
}
