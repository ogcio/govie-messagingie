/** biome-ignore-all lint/suspicious/noExplicitAny: conveniance for testing */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useRouter } from "next/navigation"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { linkAccountsAction } from "@/utils/actions"
import { Unlink } from "./Unlink"

vi.mock("@/utils/actions", () => ({
  linkAccountsAction: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(() => "/test"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))

const mockProfile = {
  id: "test-id-123",
  name: "John Doe",
}

describe("Unlink Component", () => {
  const mockRefresh = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useRouter as any).mockReturnValue({
      refresh: mockRefresh,
      replace: vi.fn(),
    })
  })

  it("should open the modal when the trigger button is clicked", () => {
    render(<Unlink profile={mockProfile as any} canonicalProfileId="canonical-123" />)
    const trigger = screen.getAllByRole("button", { name: /^unlink$/i })[0]
    fireEvent.click(trigger)

    expect(screen.getByText(`Unlink ${mockProfile.name}`)).toBeInTheDocument()
    expect(
      screen.getByText(/Are you sure you want to proceed?/i),
    ).toBeInTheDocument()
  })

  it("should call the server action and refresh the router on success", async () => {
    ;(linkAccountsAction as any).mockResolvedValue({ success: true })

    render(<Unlink profile={mockProfile as any} canonicalProfileId="canonical-123" />)

    // Open modal
    fireEvent.click(screen.getAllByRole("button", { name: /^unlink$/i })[0])

    // Click confirm in footer
    const confirmBtn = screen.getByTestId("submit-unlink-btn")
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(linkAccountsAction).toHaveBeenCalledWith({
        profileId: mockProfile.id,
        primaryUserId: null,
      })
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it("should show spinners and disable buttons while pending", async () => {
    ;(linkAccountsAction as any).mockReturnValue(
      new Promise((resolve) =>
        setTimeout(() => resolve({ success: true }), 100),
      ),
    )

    render(<Unlink profile={mockProfile as any} canonicalProfileId="canonical-123" />)
    fireEvent.click(screen.getAllByRole("button", { name: /^unlink$/i })[0])

    const confirmBtn = screen.getByTestId("submit-unlink-btn")
    fireEvent.click(confirmBtn)

    expect(confirmBtn).toBeDisabled()
    expect(screen.getByText("Cancel")).toBeDisabled()
    expect(screen.getAllByRole("status")).toHaveLength(1)
  })
})
