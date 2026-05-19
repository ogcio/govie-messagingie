"use client"

import dynamic from "next/dynamic"
import { Suspense } from "react"
import { useFeatureFlags } from "@/components/feature-flags-provider"
import { MessagesLoading } from "@/components/messages/messages-loading"

const OldMessagesPage = dynamic(
  () => import("./messages").then((mod) => mod.MessagesPage),
  { ssr: false, loading: MessagesLoading },
)

const NewUnifiedInboxPage = dynamic(
  () => import("./unified-inbox").then((mod) => mod.UnifiedInboxPage),
  { ssr: false, loading: MessagesLoading },
)

function MessagesPageClientInner() {
  const { isUnifiedInboxEnabled, isFlagsReady } = useFeatureFlags()

  if (!isFlagsReady) {
    return <MessagesLoading />
  }

  if (isUnifiedInboxEnabled) {
    return <NewUnifiedInboxPage />
  }

  return <OldMessagesPage />
}

export function MessagesPageClient() {
  return (
    <Suspense fallback={<MessagesLoading />}>
      <MessagesPageClientInner />
    </Suspense>
  )
}
