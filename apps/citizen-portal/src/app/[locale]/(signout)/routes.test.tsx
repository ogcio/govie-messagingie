import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import GlobalSignoutPage from "./global-signout/page"
import SignoutLayout from "./layout"

vi.mock("@/components/global-signout", () => ({
  GlobalSignout: () => <div>Signing out</div>,
}))

describe("signout app routes", () => {
  it("uses a passthrough layout", () => {
    render(
      <SignoutLayout>
        <p>Signout content</p>
      </SignoutLayout>,
    )

    expect(screen.getByText("Signout content")).toBeInTheDocument()
  })

  it("delegates the global-signout route", () => {
    render(<GlobalSignoutPage />)

    expect(screen.getByText("Signing out")).toBeInTheDocument()
  })
})
