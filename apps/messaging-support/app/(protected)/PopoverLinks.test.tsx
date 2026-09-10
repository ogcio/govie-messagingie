import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { PopoverLinks } from "./PopoverLinks"

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("email=a%40b.ie"),
}))

describe("PopoverLinks", () => {
  it("opens a popover with profile links carrying the current search params", () => {
    render(<PopoverLinks profileId='p-1' />)

    fireEvent.click(screen.getByRole("button"))

    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/p-1/profile?email=a%40b.ie",
    )
    expect(screen.getByRole("link", { name: "Messaging" })).toHaveAttribute(
      "href",
      "/p-1/messaging?email=a%40b.ie",
    )
    expect(
      screen.getByRole("link", { name: "Accounts Linking" }),
    ).toHaveAttribute("href", "/p-1/account-linking?email=a%40b.ie")
  })
})
