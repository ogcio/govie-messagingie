"use client"

import { selectOrganization as selectOrganizationOnGateway } from "@ogcio/sag-client"
import {
  MESSAGING_PUBLIC_SERVANT_ROLE_NAME,
  type OrganizationInfo,
  useAuth,
  useSagClient,
} from "@ogcio/sag-client/react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { env } from "@/env/env.client"

export type AdminOrganization = OrganizationInfo

interface OrganizationContext {
  organizations: AdminOrganization[]
  currentOrganization: AdminOrganization | undefined
  isLoading: boolean
  setOrganization: (organizationId: string) => Promise<void>
}

export function useOrganizationContext(): OrganizationContext {
  const { claims } = useAuth()
  const client = useSagClient()
  const gatewayUrl = client.gatewayUrl ?? env.NEXT_PUBLIC_SAG_URL

  const [organizations, setOrganizations] = useState<AdminOrganization[]>([])
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [orgsResp, selectedResp] = await Promise.all([
          fetch(`${gatewayUrl}/auth/organizations`, {
            credentials: "include",
            cache: "no-store",
          }),
          fetch(`${gatewayUrl}/auth/selected-organization`, {
            credentials: "include",
            cache: "no-store",
          }),
        ])
        if (cancelled) return
        const orgsBody = orgsResp.ok
          ? ((await orgsResp.json()) as { organizations?: AdminOrganization[] })
          : { organizations: [] }
        const selectedBody = selectedResp.ok
          ? ((await selectedResp.json()) as { organizationId?: string | null })
          : { organizationId: null }
        const list = (orgsBody.organizations ?? []).filter((o) =>
          o.roles?.includes(MESSAGING_PUBLIC_SERVANT_ROLE_NAME),
        )
        setOrganizations(list)
        setSelectedId(selectedBody.organizationId ?? claims?.organizations?.[0])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [gatewayUrl, claims])

  const currentOrganization = useMemo(
    () => organizations.find((o) => o.id === selectedId) ?? organizations[0],
    [organizations, selectedId],
  )

  const setOrganization = useCallback(
    async (organizationId: string) => {
      if (!organizationId || organizationId === selectedId) return
      const ok = await selectOrganizationOnGateway(gatewayUrl, organizationId)
      if (!ok) return
      window.location.reload()
    },
    [gatewayUrl, selectedId],
  )

  return {
    organizations,
    currentOrganization,
    isLoading,
    setOrganization,
  }
}
