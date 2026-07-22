"use client"

import dynamic from "next/dynamic"
import { Suspense } from "react"
import { MessagesLoading } from "@/components/messages/messages-loading"

const UnifiedInboxPage = dynamic(
  () => import("./unified-inbox").then((mod) => mod.UnifiedInboxPage),
  { ssr: false, loading: MessagesLoading },
)

export function MessagesPageClient() {
  return (
    <Suspense fallback={<MessagesLoading />}>
      <UnifiedInboxPage />
    </Suspense>
  )
}
