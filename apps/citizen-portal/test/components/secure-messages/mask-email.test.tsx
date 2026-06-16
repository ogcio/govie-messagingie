import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MaskEmail } from "@/components/secure-messages/mask-email"

/**
 * `MaskEmail` is used by the secure-messages account-linking view to
 * surface "is this the right account?" without leaking the full
 * candidate email. The masking algorithm is straightforward but
 * carries privacy guarantees we want pinned: never reveal middle
 * characters, never reveal the domain side… wait, the domain IS
 * intentionally visible (the user needs to see it to identify the
 * account), so the contract is "mask the local-part middle, leave
 * the domain intact". This suite locks that contract down.
 */
describe("MaskEmail", () => {
  it("masks the middle of the local part while preserving first + last char and the domain", () => {
    render(<MaskEmail email='alice@gov.ie' />)
    // a(lic)e -> a•••e
    expect(screen.getByText("a•••e@gov.ie")).toBeInTheDocument()
  })

  it("leaves the domain intact verbatim", () => {
    render(<MaskEmail email='john.doe@really.long.domain.ie' />)
    // local part is 8 chars: j(ohn.do)e -> j••••••e ; domain unchanged
    expect(
      screen.getByText("j••••••e@really.long.domain.ie"),
    ).toBeInTheDocument()
  })

  it("returns the empty string for an empty email", () => {
    const { container } = render(<MaskEmail email='' />)
    expect(container.textContent).toBe("")
  })

  it("returns the input verbatim when the local part is too short to mask meaningfully", () => {
    // 2-char local parts can't be safely masked (first + last char IS
    // the whole local part), so the helper short-circuits and returns
    // the input unchanged. Anything shorter goes through the same
    // branch. Pinning this stops a future refactor from accidentally
    // producing "@" or an empty masked local-part for short emails.
    render(<MaskEmail email='ab@gov.ie' />)
    expect(screen.getByText("ab@gov.ie")).toBeInTheDocument()
  })

  it("returns the input verbatim when the email is missing a domain", () => {
    render(<MaskEmail email='no-at-sign' />)
    expect(screen.getByText("no-at-sign")).toBeInTheDocument()
  })

  it("returns the input verbatim when the local part is missing", () => {
    render(<MaskEmail email='@gov.ie' />)
    expect(screen.getByText("@gov.ie")).toBeInTheDocument()
  })

  it("renders a single span so callers can style the masked email inline", () => {
    const { container } = render(<MaskEmail email='alice@gov.ie' />)
    const spans = container.querySelectorAll("span")
    expect(spans).toHaveLength(1)
  })
})
