"use client"

import { useGatewayFetch } from "@ogcio/sag-client/react"
import { useSearchParams } from "next/navigation"
import { EmailProviderForm } from "@/components/providers/EmailProviderForm"
import type { EmailProviderApiPayload } from "@/types/types"
import { messagingApi } from "@/util/api-paths"

export function EmailProviderFormClient() {
  const searchParams = useSearchParams()
  const id = searchParams.get("id")

  const { data, isLoading } = useGatewayFetch<EmailProviderApiPayload>(
    id ? messagingApi.provider(id) : null,
  )

  if (id && isLoading) {
    return null
  }

  if (data) {
    return <EmailProviderForm provider={data} />
  }

  return <EmailProviderForm />
}
