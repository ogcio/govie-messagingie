import { Link, type LinkProps } from "@ogcio/design-system-react"

export const BoldLink = ({
  href,
  children,
  ...props
}: { href: string; children: React.ReactNode } & LinkProps) => {
  return (
    <Link href={href} {...props}>
      <span className='gi-font-bold'>{children}</span>
    </Link>
  )
}
