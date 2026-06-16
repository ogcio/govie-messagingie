"use client"

import { getCrossZoneHref, type Zone } from "./cross-zone"
import { useEnv } from "./env/use-env"

/**
 * Returns a stable `(zone, path) => href` builder bound to the current env's
 * zone hosts. Zones may use the result anywhere a normal href string is
 * needed (anchor `href`, `router.push`, `window.location.assign`, ...).
 *
 * Example:
 *   const linkTo = useCrossZoneLink()
 *   <a href={linkTo("profile", "/personal-details")}>...</a>
 */
export function useCrossZoneLink(): (zone: Zone, path: string) => string {
  const { hosts } = useEnv()
  return (zone, path) => getCrossZoneHref(zone, path, hosts)
}
