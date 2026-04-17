/** biome-ignore-all lint/suspicious/noExplicitAny: convenience for testing */
import { fireEvent, render, screen } from "@testing-library/react"
import { useRouter } from "next/navigation"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { LinkingForms } from "."

vi.mock("@/utils/actions", () => ({
  linkAccountsAction: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => "/test"),
}))

let mockLookupResult: any = { id: "new-id", links: [], name: "New User" }

vi.mock("./LookupForm", () => ({
  LookupForm: ({ submitCallback }: any) => (
    <button type='button' onClick={() => submitCallback(mockLookupResult)}>
      Mock Lookup Submit
    </button>
  ),
}))

vi.mock("./ConfirmLinkForm", () => ({
  ConfirmLinkForm: () => <button type='button'>Mock Confirm Submit</button>,
}))

vi.mock("./CircularProfile", () => ({
  CircularProfile: () => <div>Circular Component</div>,
}))

vi.mock("./AlreadyLinkedProfile", () => ({
  AlreadyLinkedProfile: () => <div>Already Linked Component</div>,
}))

describe("LinkingForms Orchestrator", () => {
  const mockRefresh = vi.fn()
  const canonicalId = "canonical-123"

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useRouter as any).mockReturnValue({ refresh: mockRefresh })
  })

  it.each([
    {
      desc: "Circular (Same ID)",
      profile: { id: "canonical-123", links: [], name: "Self" },
      expected: "Circular Component",
    },
    {
      desc: "Circular (In Links)",
      profile: {
        id: "other",
        links: [{ id: "canonical-123" }],
        name: "Linked to Me",
      },
      expected: "Circular Component",
    },
    {
      desc: "Already Linked",
      profile: {
        id: "other",
        links: [{ id: "someone-else" }],
        name: "Linked to Other",
      },
      expected: "Already Linked Component",
    },
    {
      desc: "Valid for linking",
      profile: { id: "other", links: [], name: "Clean Profile" },
      expected: "Mock Confirm Submit",
    },
  ])("Transitions to $expected when profile is $desc", ({
    profile,
    expected,
  }) => {
    mockLookupResult = profile

    render(<LinkingForms toSetAsParentId={canonicalId} />)

    fireEvent.click(screen.getByText("Mock Lookup Submit"))

    if (expected === "Mock Confirm Submit") {
      expect(screen.getByText(expected)).toBeInTheDocument()
    } else {
      expect(screen.getByText(expected)).toBeInTheDocument()
    }
  })
})
