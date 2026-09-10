import { createNavigation } from "next-intl/navigation"
import type { ComponentProps } from "react"
import { routing } from "./routing"

// Lightweight wrappers around Next.js' navigation
// APIs that consider the routing configuration
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)

export const LinkWithoutPrefetch = ({
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, "key"> & {
  children: React.ReactNode
}) => {
  return (
    <Link prefetch={false} {...props}>
      {children}
    </Link>
  )
}
