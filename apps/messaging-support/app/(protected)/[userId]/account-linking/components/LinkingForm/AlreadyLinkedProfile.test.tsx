/** biome-ignore-all lint/suspicious/noExplicitAny: convenience for testing */
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AlreadyLinkedProfile } from "./AlreadyLinkedProfile"

describe("AlreadyLinkedProfile", () => {
  it("renders profile details and handles the back button", () => {
    const onCancel = vi.fn()
    const mockProfile = {
      name: "John Doe",
      email: "john@example.com",
      id: "logto_123",
    }

    render(
      <AlreadyLinkedProfile profile={mockProfile as any} onCancel={onCancel} />,
    )

    expect(screen.getByText("John Doe")).toBeInTheDocument()
    expect(screen.getByText(/logto_123/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /back/i }))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
