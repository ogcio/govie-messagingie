import { Link } from "@ogcio/design-system-react"

export const DrawerLink = ({
  children,
  isBold,
  ...props
}: {
  children: React.ReactNode
  isBold?: boolean
} & React.HTMLAttributes<HTMLAnchorElement> & { href: string }) => {
  return (
    <Link {...props}>
      <span
        style={{
          fontWeight: isBold ? "var(--gieds-font-weight-700)" : "normal",
        }}
      >
        {children}
      </span>
    </Link>
  )
}
