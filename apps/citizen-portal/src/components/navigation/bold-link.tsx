import { Link, type LinkProps } from "@ogcio/design-system-react"
import type { ReactNode } from "react"

export function BoldLink({
  href,
  children,
  ...props
}: { href: string; children: ReactNode } & LinkProps) {
  return (
    <Link href={href} {...props}>
      <span className='gi-font-bold'>{children}</span>
    </Link>
  )
}
