"use client"

import { type ReactNode, useEffect, useState } from "react"
import { ClientShell as MessagingAdminShell } from "@/components/client-shell"
import { ClientShell as ProfileAdminShell } from "@/components/profile-admin/client-shell"
import { getZoneFromHostname, type Zone } from "@/util/zone"

/**
 * Zone-aware authenticated layout wrapper.
 *
 * The two admin apps ship distinct shells (different role guards, different
 * navigation) that still coexist inside the same static export. We can only
 * pick between them once JavaScript can read `window.location.hostname`.
 * Rendering `null` until we know the zone avoids flashing the wrong shell
 * for public-servants who land on `profile-admin.*` — auth is JS-gated
 * anyway so there is no meaningful no-script fallback to preserve.
 */
export function AuthenticatedShellDispatcher({
  children,
}: {
  children: ReactNode
}) {
  const [zone, setZone] = useState<Zone | null>(null)

  useEffect(() => {
    setZone(getZoneFromHostname(window.location.hostname))
  }, [])

  if (zone === null) return null
  if (zone === "profile-admin") {
    return <ProfileAdminShell>{children}</ProfileAdminShell>
  }
  return <MessagingAdminShell>{children}</MessagingAdminShell>
}
