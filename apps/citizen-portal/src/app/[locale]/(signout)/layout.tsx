import type { ReactNode } from "react"

/**
 * (signout)/ — passthrough layout for the global-signout flow.
 *
 * No shell mounts: the global-signout page renders only a spinner +
 * hidden iframes that fan out to every app's `/api/application-signout`
 * endpoint, so the standard chrome would compete with the redirect for
 * the visible viewport.
 */
export { generateStaticParams } from "@/util/route-helpers"

export default function SignoutLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
