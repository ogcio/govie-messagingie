/**
 * Zone dispatch for the unified public-servant portal.
 *
 * The single static export is served from two hostnames — messaging-admin.*
 * and profile-admin.* — behind one nginx pod (see docker/nginx.conf.template).
 * Because the HTML is baked at build time, JavaScript reads
 * `window.location.hostname` at runtime to decide which zone-specific shell,
 * default landing, and role guard applies. Match by the leading label so
 * unrelated `.services.gov.ie` hosts fall back to the messaging default.
 */

export type Zone = "messaging-admin" | "profile-admin"

export const DEFAULT_ZONE: Zone = "messaging-admin"

export function getZoneFromHostname(hostname: string | undefined): Zone {
  if (!hostname) return DEFAULT_ZONE
  if (/^profile-admin(\.|$)/.test(hostname)) return "profile-admin"
  return "messaging-admin"
}

export const ZONE_DEFAULT_PATH: Record<Zone, string> = {
  "messaging-admin": "send-a-message",
  "profile-admin": "service-users",
}

/**
 * SAG `appName` the gateway uses to identify which upstream service to
 * proxy a request to. The consolidated app serves two hostnames from one
 * static export, so zone identity cannot be a single build-time env —
 * each zone hardcodes its own SAG identity, matching the `sagAppName`
 * per-zone-config pattern citizen-portal uses.
 */
export const ZONE_SAG_APP_NAME: Record<Zone, string> = {
  "messaging-admin": "messaging-admin",
  "profile-admin": "profile-admin",
}

/**
 * Org ids this zone may keep as `sag_selected_org`.
 *
 * The cookie is shared across `.local.test` / `.services.gov.ie`, so a
 * profile-admin visit can leave an org that has Profile PS but not
 * Messaging PS (or vice versa). SAG then mints an org token without
 * this zone's scopes and the first API call 403s.
 *
 * Prefer `organization_roles` (`orgId:Role Name`). Fall back to
 * `organizations` only when the role claim is absent, so older tokens
 * that only list membership still work.
 */
export function organizationIdsForRole(
  claims:
    | { organizations?: string[]; organization_roles?: string[] }
    | undefined,
  roleName: string,
): string[] {
  const orgRoles = claims?.organization_roles
  if (orgRoles && orgRoles.length > 0) {
    return orgRoles.flatMap((entry) => {
      const sep = entry.indexOf(":")
      if (sep < 0) return []
      return entry.slice(sep + 1) === roleName ? [entry.slice(0, sep)] : []
    })
  }
  return claims?.organizations ?? []
}
