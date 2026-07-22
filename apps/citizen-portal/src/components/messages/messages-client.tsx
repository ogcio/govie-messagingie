"use client"

import { useEffect } from "react"
import { UnifiedInboxPage } from "./unified-inbox"

export function MessagesPageClient() {
  useEffect(() => {
    void import("./unified-inbox")
  }, [])

  return <UnifiedInboxPage />
}
