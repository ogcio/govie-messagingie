/** biome-ignore-all lint/suspicious/noExplicitAny: convenience for testing */
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CircularProfile } from "./CircularProfile"

describe("CircularProfile", () => {
  it("renders specific circular link warning and handles back button", () => {
    const onCancel = vi.fn()
    const mockProfile = {
      name: "Jane Smith",
      email: "jane@smith.com",
      id: "logto_abc_789",
    }

    render(<CircularProfile profile={mockProfile as any} onCancel={onCancel} />)

    expect(
      screen.getByText(/belongs to the same linked group/i),
    ).toBeInTheDocument()

    expect(screen.getByText("Jane Smith")).toBeInTheDocument()
    expect(screen.getByText(/logto_abc_789/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /back/i }))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
