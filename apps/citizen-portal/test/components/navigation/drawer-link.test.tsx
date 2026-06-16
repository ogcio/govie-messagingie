import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DrawerLink } from "@/components/navigation/drawer-link"

// DS exposes its <Link> as a pass-through anchor; the stub mirrors
// that surface so the test can assert on the rendered `<a href=…>`
// without dragging in DS's full theming pipeline (which trips on
// CSS module + ESM resolution under jsdom).
vi.mock("@ogcio/design-system-react", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string
    children: React.ReactNode
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

/**
 * `<DrawerLink>` is the link primitive used by the unified
 * `<PageHeader>` drawer for cross-zone navigation. The test pins
 * (a) that the absolute cross-zone hrefs reach the anchor verbatim
 * (so canonicalisation has nothing to "fix" client-side), and
 * (b) that the bold prop drives the typography style hook the
 * Drawer relies on for the primary vs. secondary item visual.
 */
describe("DrawerLink", () => {
  it("renders an absolute cross-zone href verbatim — no client-side rewriting", () => {
    render(
      <DrawerLink href='https://messaging.dev.services.gov.ie/en/messages'>
        Messages
      </DrawerLink>,
    )
    const link = screen.getByRole("link", { name: "Messages" })
    expect(link).toHaveAttribute(
      "href",
      "https://messaging.dev.services.gov.ie/en/messages",
    )
  })

  it("renders a same-zone path href as-is (no protocol-up-conversion)", () => {
    // For in-zone links (e.g. the language switcher) the href is a
    // root-relative path; nginx + Next routing handle it without help
    // from JS. Pinning this stops a future refactor from accidentally
    // upgrading every link to a getCrossZoneHref call (which would
    // produce an absolute URL and break SPA navigation).
    render(<DrawerLink href='/en/messages'>Messages</DrawerLink>)
    expect(screen.getByRole("link", { name: "Messages" })).toHaveAttribute(
      "href",
      "/en/messages",
    )
  })

  it("applies bold typography to primary items only", () => {
    const { rerender } = render(
      <DrawerLink href='/en/messages' bold>
        Bold item
      </DrawerLink>,
    )
    const boldSpan = screen.getByText("Bold item")
    expect(boldSpan).toHaveStyle({ fontWeight: "var(--gieds-font-weight-700)" })

    rerender(<DrawerLink href='/en/messages'>Normal item</DrawerLink>)
    const normalSpan = screen.getByText("Normal item")
    expect(normalSpan).toHaveStyle({ fontWeight: "normal" })
  })
})
