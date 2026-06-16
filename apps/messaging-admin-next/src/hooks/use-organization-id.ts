"use client"

import { useAuth } from "@ogcio/sag-client/react"
import { useOrganizationContext } from "./use-organization-context"

export function useOrganizationId(): string | undefined {
  const { currentOrganization } = useOrganizationContext()
  const { claims } = useAuth()
  return currentOrganization?.id ?? claims?.organizations?.[0]
}
