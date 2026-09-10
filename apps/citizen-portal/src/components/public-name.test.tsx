import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authState = vi.hoisted(() => ({
  user: { sub: "user-1" } as { sub: string } | undefined,
}))
vi.mock("@ogcio/sag-client/react", () => ({
  useAuth: () => ({ user: authState.user }),
}))

const nameState = vi.hoisted(() => ({ publicName: "", isLoading: false }))
vi.mock("@/hooks/use-public-name", () => ({
  usePublicName: () => nameState,
}))

import { PublicName } from "@/components/public-name"

/**
 * The single renderer for the signed-in user's name, so the drawer and the
 * dashboard heading cannot disagree about which field to read.
 */
describe("PublicName", () => {
  beforeEach(() => {
    authState.user = { sub: "user-1" }
    nameState.publicName = ""
    nameState.isLoading = false
  })

  it("renders a skeleton instead of a name while the lookup is loading", () => {
    nameState.isLoading = true
    // A stale value alongside isLoading must not win.
    nameState.publicName = "Isah Davis"
    render(<PublicName />)

    expect(screen.getByTestId("public-name-skeleton")).toBeInTheDocument()
    expect(screen.queryByText("Isah Davis")).not.toBeInTheDocument()
  })

  it("marks the loading region as busy for assistive tech", () => {
    // The skeleton is aria-hidden, so the region must carry the busy state.
    nameState.isLoading = true
    const { container } = render(<PublicName />)
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull()
  })

  it("renders the resolved name once the lookup settles", () => {
    nameState.publicName = "Toby Tobysone 2"
    render(<PublicName />)

    expect(screen.getByText("Toby Tobysone 2")).toBeInTheDocument()
    expect(screen.queryByTestId("public-name-skeleton")).not.toBeInTheDocument()
  })

  it("renders nothing rather than a stuck skeleton when there is no name", () => {
    render(<PublicName />)
    expect(screen.queryByTestId("public-name-skeleton")).not.toBeInTheDocument()
  })
})
