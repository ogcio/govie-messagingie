import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@ogcio/design-system-react", () => ({
  DataTableHeader: ({ children }: React.PropsWithChildren) => (
    <header>{children}</header>
  ),
  DataTableHeaderSearch: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
}))

vi.mock("./inbox-list-search-field", () => ({
  InboxListSearchField: () => <input aria-label='Search messages' />,
}))

import { InboxSearch } from "./inbox-search"

describe("InboxSearch", () => {
  it("renders the shared search field in the table header", () => {
    render(<InboxSearch />)

    expect(screen.getByRole("banner")).toContainElement(
      screen.getByRole("textbox", { name: "Search messages" }),
    )
  })
})
