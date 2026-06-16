import type { ReactNode } from "react"
import { ClientShell } from "@/components/client-shell"

/**
 * (authenticated)/ — auth-gated route group.
 *
 * Wraps every authenticated zone (messages, my-profile, dashboard) in
 * the single shared `ClientShell`. The shell derives its per-zone
 * behaviour (SAG appName, PS role, consent banner, stale-claims gate)
 * from the active pathname via `ZONE_CONFIG` — see
 * `@/components/client-shell` for the table.
 *
 * Public routes live under `(public)/` and `(signout)/`, which have
 * their own non-auth shells so unauthenticated visits to e.g.
 * cookie-policy don't pay the SAG round-trip.
 */
export { generateStaticParams } from "@/util/route-helpers"

export default function AuthenticatedLayout({
  children,
}: {
  children: ReactNode
}) {
  return <ClientShell>{children}</ClientShell>
}
