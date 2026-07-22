"use client"

import type { AuthUser } from "@ogcio/sag-client"
import { useGatewayFetch } from "@ogcio/sag-client/react"
import { useIdleMount } from "@/hooks/use-idle-mount"

interface Profile {
  publicName: string
}

/**
 * Resolves the user's display name with a graceful fallback chain:
 *
 *   1. profile-service `publicName` (the citizen-chosen name)
 *   2. SAG `user.name` (the IdP-provided display name)
 *   3. SAG `user.email`
 *   4. empty string
 *
 * The profile fetch is keyed on `user.sub` so it stays paused until
 * auth has resolved. Used by the dashboard welcome heading and by the
 * authenticated `PageHeader` when ClientShell doesn't have a richer
 * name source.
 */
export function usePublicName(user: AuthUser | undefined): string {
  const idleReady = useIdleMount()
  const { data } = useGatewayFetch<Profile>(
    user?.sub && idleReady ? `/profile/api/v1/profiles/${user.sub}` : null,
  )

  return data?.publicName ?? user?.name ?? user?.email ?? ""
}
