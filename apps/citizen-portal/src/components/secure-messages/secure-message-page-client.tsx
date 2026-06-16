"use client"

import dynamic from "next/dynamic"

export const SecureMessagePageClient = dynamic(
  () => import("./secure-message-page").then((mod) => mod.SecureMessagePage),
  { ssr: false },
)
