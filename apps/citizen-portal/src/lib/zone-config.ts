import {
  MESSAGING_PUBLIC_SERVANT_ROLE_NAME,
  PROFILE_PUBLIC_SERVANT_ROLE_NAME,
} from "@ogcio/sag-client/react"
import type { Zone } from "@/util/get-zone-from-path"

/**
 * Per-zone configuration consumed by the unified `ClientShell`,
 * `PageHeader`, etc. Centralising the table keeps the shared chrome
 * components free of zone-specific switch statements at every callsite.
 *
 * Adding a new zone is an edit to this file plus an entry in
 * `getZoneFromPath()`.
 */
export type ZoneConfig = {
  /**
   * SAG app name passed to `CitizenSagProvider`. Affects the session
   * audience the gateway issues and the post-auth redirect targets it
   * picks. Pre-B2, each zone hard-coded its own value.
   */
  sagAppName: string

  /**
   * The PS role that the onboarding guard treats as "this user is a
   * public servant for THIS app — bounce them to admin". Must match
   * the matching admin app's own `usePublicServantGuard` definition,
   * or the user gets stranded ping-ponging between citizen and admin.
   */
  publicServantRoleName: string

  /**
   * Where to send PS users that the onboarding guard bounces. Env-var
   * key (not URL) — the runtime reads the actual URL from `env.client`
   * keyed by this name so the table stays free of env imports.
   */
  publicServantRedirectEnvKey:
    | "NEXT_PUBLIC_MESSAGING_ADMIN_URL"
    | "NEXT_PUBLIC_PROFILE_ADMIN_URL"
    | "NEXT_PUBLIC_DASHBOARD_ADMIN_URL"

  /**
   * Default in-zone landing path used by `PageHeader` for the logo
   * link. Locale prefix is added at the callsite.
   */
  rootPath: string

  /**
   * Whether the zone shows the consent banner + announcements modal in
   * the authenticated shell. Today messages is the only consumer
   * (consent is messaging-only).
   */
  showsConsentAndAnnouncements: boolean

  /**
   * Whether the zone runs the post-onboarding stale-claims refresh
   * gate. Only the messages zone uses it today (it's the most likely
   * landing after profile onboarding completes).
   */
  runsStaleClaimsGate: boolean
}

export const ZONE_CONFIG: Record<Zone, ZoneConfig> = {
  messages: {
    sagAppName: "messaging",
    publicServantRoleName: MESSAGING_PUBLIC_SERVANT_ROLE_NAME,
    publicServantRedirectEnvKey: "NEXT_PUBLIC_MESSAGING_ADMIN_URL",
    rootPath: "/messages",
    showsConsentAndAnnouncements: true,
    runsStaleClaimsGate: true,
  },
  profile: {
    sagAppName: "profile",
    publicServantRoleName: PROFILE_PUBLIC_SERVANT_ROLE_NAME,
    publicServantRedirectEnvKey: "NEXT_PUBLIC_PROFILE_ADMIN_URL",
    rootPath: "/my-profile",
    showsConsentAndAnnouncements: false,
    runsStaleClaimsGate: false,
  },
  dashboard: {
    sagAppName: "dashboard",
    // Dashboard has no zone-specific PS role today — its onboarding
    // guard just relies on `publicServantRedirectUrl` to send PS users
    // to dashboard-admin without checking a role name. The messaging
    // role is the safest non-empty placeholder (it never matches in
    // the dashboard context, which is the desired behaviour).
    publicServantRoleName: MESSAGING_PUBLIC_SERVANT_ROLE_NAME,
    publicServantRedirectEnvKey: "NEXT_PUBLIC_DASHBOARD_ADMIN_URL",
    rootPath: "/my-dashboard",
    showsConsentAndAnnouncements: false,
    runsStaleClaimsGate: false,
  },
}
