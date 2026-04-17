import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockPush = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(mockSearchParams),
}))

vi.mock("@ogcio/design-system-react", () => ({
  Pagination: ({
    currentPage,
    totalPages,
    onPageChange,
  }: {
    currentPage: number
    totalPages: number
    onPageChange: (page: number) => void
  }) => (
    <nav data-testid="pagination">
      <span data-testid="current-page">{currentPage}</span>
      <span data-testid="total-pages">{totalPages}</span>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
        <button
          key={page}
          type="button"
          data-testid={`page-${page}`}
          onClick={() => onPageChange(page)}
          aria-current={page === currentPage ? "page" : undefined}
        >
          {page}
        </button>
      ))}
    </nav>
  ),
}))

let mockSearchParams = ""

import { PaginationWrapper } from "@/components/messages/pagination-wrapper"

describe("PaginationWrapper", () => {
  beforeEach(() => {
    mockSearchParams = ""
    mockPush.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders nothing when totalPages is 0", () => {
    const { container } = render(<PaginationWrapper totalPages={0} />)
    expect(container.innerHTML).toBe("")
  })

  it("renders nothing when totalPages is 1", () => {
    const { container } = render(<PaginationWrapper totalPages={1} />)
    expect(container.innerHTML).toBe("")
  })

  it("renders pagination when totalPages > 1", () => {
    render(<PaginationWrapper totalPages={3} />)
    expect(screen.getByTestId("pagination")).toBeDefined()
  })

  it("defaults currentPage to 1 when no page param exists", () => {
    render(<PaginationWrapper totalPages={3} />)
    expect(screen.getByTestId("current-page").textContent).toBe("1")
  })

  it("reads currentPage from URL search params", () => {
    mockSearchParams = "page=2"
    render(<PaginationWrapper totalPages={3} />)
    expect(screen.getByTestId("current-page").textContent).toBe("2")
  })

  it("passes totalPages to the Pagination component", () => {
    render(<PaginationWrapper totalPages={5} />)
    expect(screen.getByTestId("total-pages").textContent).toBe("5")
  })

  it("navigates to the selected page on click", async () => {
    const user = userEvent.setup()
    render(<PaginationWrapper totalPages={3} />)

    await user.click(screen.getByTestId("page-2"))
    expect(mockPush).toHaveBeenCalledWith("?page=2")
  })

  it("preserves existing search params when changing page", async () => {
    mockSearchParams = "tab=all&search=hello"
    const user = userEvent.setup()
    render(<PaginationWrapper totalPages={3} />)

    await user.click(screen.getByTestId("page-3"))
    const pushed = mockPush.mock.calls[0][0] as string
    const params = new URLSearchParams(pushed.replace("?", ""))
    expect(params.get("tab")).toBe("all")
    expect(params.get("search")).toBe("hello")
    expect(params.get("page")).toBe("3")
  })

  it("preserves tab param when navigating pages", async () => {
    mockSearchParams = "tab=unread"
    const user = userEvent.setup()
    render(<PaginationWrapper totalPages={5} />)

    await user.click(screen.getByTestId("page-4"))
    const pushed = mockPush.mock.calls[0][0] as string
    const params = new URLSearchParams(pushed.replace("?", ""))
    expect(params.get("tab")).toBe("unread")
    expect(params.get("page")).toBe("4")
  })

  it("overwrites existing page param when navigating", async () => {
    mockSearchParams = "page=2&tab=all"
    const user = userEvent.setup()
    render(<PaginationWrapper totalPages={5} />)

    await user.click(screen.getByTestId("page-3"))
    const pushed = mockPush.mock.calls[0][0] as string
    const params = new URLSearchParams(pushed.replace("?", ""))
    expect(params.get("page")).toBe("3")
    expect(params.get("tab")).toBe("all")
  })
})
