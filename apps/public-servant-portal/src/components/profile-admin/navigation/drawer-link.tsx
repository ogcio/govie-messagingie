import { Link } from "@ogcio/design-system-react"
import type { ReactNode } from "react"

export function DrawerLink({
  href,
  bold,
  children,
}: {
  href: string
  bold?: boolean
  children: ReactNode
}) {
  return (
    <Link href={href}>
      <span
        style={{
          fontWeight: bold ? "var(--gieds-font-weight-700)" : "normal",
        }}
      >
        {children}
      </span>
    </Link>
  )
}
