/** biome-ignore-all lint/suspicious/noExplicitAny: convenience for testing */
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ConfirmLinkForm } from "./ConfirmLinkForm"

const mockProfile = {
  id: "logto_123",
  name: "John Doe",
  email: "john@doe.com",
  links: [{ id: "link_1", name: "Secondary Account", email: "sec@doe.com" }],
}

const defaultProps = {
  profile: mockProfile as any,
  isPending: false,
  onFormSubmit: vi.fn(),
  onFormCancel: vi.fn(),
  primaryProfileId: "primary_456",
}

describe("ConfirmLinkForm", () => {
  it("renders profile details and the linked accounts table", () => {
    render(<ConfirmLinkForm {...defaultProps} />)

    expect(screen.getByText("John Doe")).toBeInTheDocument()
    expect(screen.getByText("Linked accounts: 1")).toBeInTheDocument()
    expect(screen.getByText("Secondary Account")).toBeInTheDocument()
  })

  it("handles empty links array correctly", () => {
    const profileNoLinks = { ...mockProfile, links: [] }
    render(
      <ConfirmLinkForm {...defaultProps} profile={profileNoLinks as any} />,
    )

    expect(
      screen.queryByText(/and it's linked accounts/i),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Linked accounts: 0/i)).toBeInTheDocument()

    const accordionHeader = screen.getByText(/Linked accounts: 0/i)
    const accordionContainer = accordionHeader.closest(
      '[data-testid="accordion-item"]',
    )

    expect(accordionContainer).toHaveAttribute("data-disabled", "true")
    expect(accordionContainer).toHaveAttribute("tabindex", "0")
  })

  it("triggers submit with the correct ID", () => {
    const onFormSubmit = vi.fn()
    render(<ConfirmLinkForm {...defaultProps} onFormSubmit={onFormSubmit} />)

    fireEvent.click(screen.getByRole("button", { name: /link accounts/i }))
    expect(onFormSubmit).toHaveBeenCalledWith("logto_123")
  })

  it("shows spinners and disables buttons when pending", () => {
    render(<ConfirmLinkForm {...defaultProps} isPending={true} />)

    expect(
      screen.getByRole("button", { name: /link accounts/i }),
    ).toBeDisabled()
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled()
    expect(screen.getAllByRole("status")).toHaveLength(1)
  })

  it("should trigger onFormCancel when the back/cancel button is clicked", () => {
    const onCancel = vi.fn()
    render(<ConfirmLinkForm {...defaultProps} onFormCancel={onCancel} />)

    const cancelBtn = screen.getByRole("button", { name: /cancel/i })
    fireEvent.click(cancelBtn)

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
