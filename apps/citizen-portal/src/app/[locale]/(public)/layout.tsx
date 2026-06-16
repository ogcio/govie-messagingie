import type { ReactNode } from "react"
import { PublicShell } from "@/components/public-shell"

/**
 * (public)/ — unauthenticated route group.
 *
 * Wraps every visitor-facing informational page (privacy, cookies,
 * accessibility, contact support, wrong-account-error,
 * wrong-login-method-error) in the shared `PublicShell`. No SAG
 * provider mounts here — these pages must be reachable without a
 * session so the gateway's error redirects don't loop.
 */
export { generateStaticParams } from "@/util/route-helpers"

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>
}
