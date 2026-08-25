import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { InboxListChromeHeader } from "@/components/messages/inbox-list-chrome-header"

// Viewport is the whole point of this suite; jsdom's `matchMedia` never
// evaluates the query, so drive the hook directly.
const { isMobile } = vi.hoisted(() => ({ isMobile: { value: false } }))
vi.mock("@/hooks/use-is-mobile", () => ({
  useIsMobile: () => isMobile.value,
}))

function renderHeader() {
  return render(
    <InboxListChromeHeader
      showToolbar
      searchChrome={<input data-testid='search-input' />}
      bulkActionBar={<div data-testid='bulk-action-bar'>1 selected</div>}
    />,
  )
}

describe("InboxListChromeHeader", () => {
  beforeEach(() => {
    isMobile.value = false
  })

  it("swaps search for the bulk toolbar on desktop", () => {
    renderHeader()

    expect(screen.getByTestId("bulk-action-bar")).toBeInTheDocument()
    expect(
      screen.getByTestId("search-input").closest("[aria-hidden='true']"),
    ).not.toBeNull()
  })

  it("keeps search in place on mobile, where the bulk actions live in the list header", () => {
    isMobile.value = true
    renderHeader()

    expect(
      screen.getByTestId("search-input").closest("[aria-hidden='true']"),
    ).toBeNull()
    expect(screen.getByTestId("search-input")).toBeVisible()
    expect(screen.queryByTestId("bulk-action-bar")).not.toBeInTheDocument()
  })
})
