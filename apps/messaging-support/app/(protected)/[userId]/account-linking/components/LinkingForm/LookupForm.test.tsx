/** biome-ignore-all lint/suspicious/noExplicitAny: convenience for testing */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { getAccountLinkDetailsAction } from "@/utils/actions"
import { LookupForm } from "./LookupForm"

vi.mock("@/utils/actions", () => ({
  getAccountLinkDetailsAction: vi.fn(),
}))

describe("LookupForm", () => {
  const mockSubmitCallback = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should disable the button until an email is entered", () => {
    render(<LookupForm submitCallback={mockSubmitCallback} />)

    const submitBtn = screen.getByRole("button", { name: /find account/i })
    expect(submitBtn).toBeDisabled()

    const input = screen.getByPlaceholderText("Search...")
    fireEvent.change(input, { target: { value: "test@example.com" } })

    expect(submitBtn).not.toBeDisabled()
  })

  it("should call the lookup action and trigger callback on success", async () => {
    const mockProfile = { id: "123", email: "test@example.com", name: "John" }
    ;(getAccountLinkDetailsAction as any).mockResolvedValue({
      success: true,
      value: mockProfile,
    })

    render(<LookupForm submitCallback={mockSubmitCallback} />)

    fireEvent.change(screen.getByPlaceholderText("Search..."), {
      target: { value: "test@example.com" },
    })
    fireEvent.click(screen.getByRole("button", { name: /find account/i }))

    await waitFor(() => {
      expect(getAccountLinkDetailsAction).toHaveBeenCalledWith({
        type: "email",
        value: "test@example.com",
      })
      expect(mockSubmitCallback).toHaveBeenCalledWith(mockProfile)
    })
  })

  it("should display a user message on failure", async () => {
    const errorMsg = "Account not found"
    ;(getAccountLinkDetailsAction as any).mockResolvedValue({
      success: false,
      userMessage: errorMsg,
    })

    render(<LookupForm submitCallback={mockSubmitCallback} />)

    fireEvent.change(screen.getByPlaceholderText("Search..."), {
      target: { value: "missing@example.com" },
    })
    fireEvent.click(screen.getByRole("button", { name: /find account/i }))

    expect(await screen.findByText(errorMsg)).toBeInTheDocument()
    expect(
      screen.queryByText(/Enter the exact address/i),
    ).not.toBeInTheDocument()
  })

  it("should clear the error when the input is emptied", async () => {
    ;(getAccountLinkDetailsAction as any).mockResolvedValue({
      success: false,
      userMessage: "Error",
    })

    render(<LookupForm submitCallback={mockSubmitCallback} />)
    const input = screen.getByPlaceholderText("Search...")

    fireEvent.change(input, { target: { value: "bad@bad.se" } })
    fireEvent.click(screen.getByRole("button", { name: /find account/i }))

    const errorElement = await screen.findByText("Error")
    expect(errorElement).toBeInTheDocument()

    fireEvent.change(input, { target: { value: "" } })

    await waitFor(() => {
      expect(screen.queryByText("Error")).not.toBeInTheDocument()
      expect(screen.getByText(/Enter the exact address/i)).toBeInTheDocument()
    })
  })
})
