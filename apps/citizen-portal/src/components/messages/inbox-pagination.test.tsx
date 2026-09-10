import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockPush = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/en/messages",
  useSearchParams: () => new URLSearchParams(mockSearchParams),
}))

let mockSearchParams = ""

import { InboxPagination } from "@/components/messages/inbox-pagination"

describe("InboxPagination", () => {
  beforeEach(() => {
    mockSearchParams = "page=55"
    mockPush.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders page 55 in the select when totalPages is 55", async () => {
    render(<InboxPagination totalPages={55} />)

    const select = screen.getByLabelText("Select page")
    expect(select).toBeDefined()
    expect((select as HTMLSelectElement).value).toBe("55")

    const option55 = screen.getByRole("option", { name: "55" })
    expect(option55).toBeDefined()

    const user = userEvent.setup()
    await user.selectOptions(select, "50")
    expect(mockPush).toHaveBeenCalledWith("/en/messages?page=50")
  })
})
