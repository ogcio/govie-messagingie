import { fireEvent, render, screen, within } from "@testing-library/react"
import {
  type ReadonlyURLSearchParams,
  useRouter,
  useSearchParams,
} from "next/navigation"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ClientFilterKeyOption } from "@/utils/appliedFilter.types"
import Filter from "./Filter"

// Mock Next navigation hooks
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}))

const createMockSearchParams = (
  usp: URLSearchParams = new URLSearchParams(),
) => {
  return {
    get: usp.get.bind(usp),
    entries: usp.entries.bind(usp),
    keys: usp.keys.bind(usp),
    values: usp.values.bind(usp),
    toString: usp.toString.bind(usp),
    has: usp.has.bind(usp),
    [Symbol.iterator]: usp[Symbol.iterator].bind(usp),
  } as unknown as ReadonlyURLSearchParams
}

const createMockRouter = () =>
  ({
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    push: vi.fn(),
    prefetch: vi.fn(),
  }) as unknown as ReturnType<typeof useRouter>

describe("Messaging Filter component", () => {
  let router: ReturnType<typeof createMockRouter>
  let searchParams: ReturnType<typeof createMockSearchParams>

  beforeEach(() => {
    router = createMockRouter()
    searchParams = createMockSearchParams()
    vi.mocked(useRouter).mockReturnValue(router)
    vi.mocked(useSearchParams).mockReturnValue(searchParams)
    vi.clearAllMocks()
  })

  const keyOptions: ClientFilterKeyOption[] = [
    { label: "Status", value: "status", type: "boolean" },
    { label: "Delivery Date", value: "deliveryDate", type: "date" },
    { label: "Event Type", value: "eventType", type: "list" },
  ]
  it("does happy init render", () => {
    render(<Filter keyOptions={keyOptions} />)
    expect(screen.getByText("Filter")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Search")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /add filter/i })).toBeDisabled()
  })

  describe("boolean filter", () => {
    it("does happy init render", () => {
      render(<Filter keyOptions={keyOptions} />)
      const selectInput = screen.getByLabelText("Select")
      fireEvent.click(selectInput)

      const option = screen.getByText("Status")
      fireEvent.click(option)

      expect(screen.getByText("Filter")).toBeInTheDocument()
      expect(selectInput).toHaveValue("Status")
      expect(screen.getByLabelText("Successful")).toBeInTheDocument()
      expect(screen.getByLabelText("Failed")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /add filter/i })).toBeEnabled()
    })

    it("adds filter with both options true and renders chip", () => {
      render(<Filter keyOptions={keyOptions} />)
      const selectInput = screen.getByLabelText("Select")
      fireEvent.click(selectInput)

      const option = screen.getByText("Status")
      fireEvent.click(option)

      fireEvent.click(screen.getByRole("button", { name: /add filter/i }))
      expect(
        screen.getByText("Status: (successful, failed)"),
      ).toBeInTheDocument()
      expect(router.replace).toHaveBeenCalledOnce()
      expect(router.replace).toHaveBeenCalledWith(
        "?status=failed%2Csuccessful",
        { scroll: false },
      )
    })

    it("adds filter with successful true, failed false and renders chip", () => {
      render(<Filter keyOptions={keyOptions} />)
      const selectInput = screen.getByLabelText("Select")
      fireEvent.click(selectInput)

      const option = screen.getByText("Status")
      fireEvent.click(option)

      fireEvent.click(screen.getByLabelText("Failed"))

      fireEvent.click(screen.getByRole("button", { name: /add filter/i }))
      expect(screen.getByText("Status: (successful)")).toBeInTheDocument()
      expect(router.replace).toHaveBeenCalledOnce()
      expect(router.replace).toHaveBeenCalledWith("?status=successful", {
        scroll: false,
      })
    })

    it("adds filter with successful false, failed true and renders chip", () => {
      render(<Filter keyOptions={keyOptions} />)
      const selectInput = screen.getByLabelText("Select")
      fireEvent.click(selectInput)

      const option = screen.getByText("Status")
      fireEvent.click(option)

      fireEvent.click(screen.getByLabelText("Successful"))

      fireEvent.click(screen.getByRole("button", { name: /add filter/i }))
      expect(screen.getByText("Status: (failed)")).toBeInTheDocument()
      expect(router.replace).toHaveBeenCalledOnce()
      expect(router.replace).toHaveBeenCalledWith("?status=failed", {
        scroll: false,
      })
    })

    it("adds filter with both successful and failed false and renders chip", () => {
      render(<Filter keyOptions={keyOptions} />)
      const selectInput = screen.getByLabelText("Select")
      fireEvent.click(selectInput)

      const option = screen.getByText("Status")
      fireEvent.click(option)

      fireEvent.click(screen.getByLabelText("Successful"))
      fireEvent.click(screen.getByLabelText("Failed"))

      fireEvent.click(screen.getByRole("button", { name: /add filter/i }))
      expect(screen.getByText("Status: None")).toBeInTheDocument()
      expect(router.replace).toHaveBeenCalledOnce()
      expect(router.replace).toHaveBeenCalledWith("?status=", { scroll: false })
    })
  })

  describe("date filter", () => {
    it("does happy init render", () => {
      render(<Filter keyOptions={keyOptions} />)
      const selectInput = screen.getByLabelText("Select")
      fireEvent.click(selectInput)

      const option = screen.getByLabelText("Delivery Date")
      fireEvent.click(option)

      expect(screen.getByText("Filter")).toBeInTheDocument()
      expect(selectInput).toHaveValue("Delivery Date")

      expect(document.querySelector("input#range-selector")).toHaveValue(
        "between",
      )
      expect(document.querySelector("input#from-date")).toHaveValue("")
      expect(screen.getByText("and")).toBeInTheDocument()
      expect(document.querySelector("input#to-date")).toHaveValue("")

      expect(screen.getByRole("button", { name: /add filter/i })).toBeDisabled()
    })

    it("adds filter with between dates and renders chip", () => {
      render(<Filter keyOptions={keyOptions} />)
      const selectInput = screen.getByLabelText("Select")
      fireEvent.click(selectInput)

      const option = screen.getByLabelText("Delivery Date")
      fireEvent.click(option)

      const from: HTMLInputElement | null =
        document.querySelector("input#from-date")
      const to: HTMLInputElement | null =
        document.querySelector("input#to-date")
      expect(from).not.toBeNull()
      expect(to).not.toBeNull()
      if (!from || !to) {
        return
      }
      fireEvent.change(from, { target: { value: "2025-01-01" } })
      fireEvent.change(to, { target: { value: "2025-11-11" } })
      fireEvent.click(screen.getByRole("button", { name: /add filter/i }))

      expect(
        screen.getByText("Delivery Date: between 2025-01-01 and 2025-11-11"),
      ).toBeInTheDocument()
      expect(router.replace).toHaveBeenCalledOnce()
      expect(router.replace).toHaveBeenCalledWith(
        "?deliveryDate=between%2C2025-01-01%2C2025-11-11",
        { scroll: false },
      )
    })

    it("adds filter with from date and renders chip", () => {
      render(<Filter keyOptions={keyOptions} />)
      const selectInput = screen.getByLabelText("Select")
      fireEvent.click(selectInput)

      const option = screen.getByLabelText("Delivery Date")
      fireEvent.click(option)

      const rangeSelector = document.querySelector("input#range-selector")
      expect(rangeSelector).not.toBeNull()
      if (!rangeSelector) {
        return
      }

      fireEvent.click(rangeSelector)
      fireEvent.click(screen.getByLabelText("from"))

      const from: HTMLInputElement | null =
        document.querySelector("input#from-date")
      const to: HTMLInputElement | null =
        document.querySelector("input#to-date")
      expect(from).not.toBeNull()
      expect(to).toBeNull()
      if (!from) {
        return
      }

      fireEvent.change(from, { target: { value: "2025-01-01" } })

      fireEvent.click(screen.getByRole("button", { name: /add filter/i }))

      expect(
        screen.getByText("Delivery Date: from 2025-01-01"),
      ).toBeInTheDocument()
      expect(router.replace).toHaveBeenCalledOnce()
      expect(router.replace).toHaveBeenCalledWith(
        "?deliveryDate=from%2C2025-01-01",
        { scroll: false },
      )
    })

    it("adds filter with to date and renders chip", () => {
      render(<Filter keyOptions={keyOptions} />)
      const selectInput = screen.getByLabelText("Select")
      fireEvent.click(selectInput)

      const option = screen.getByLabelText("Delivery Date")
      fireEvent.click(option)

      const rangeSelector = document.querySelector("input#range-selector")
      expect(rangeSelector).not.toBeNull()
      if (!rangeSelector) {
        return
      }

      fireEvent.click(rangeSelector)
      fireEvent.click(screen.getByLabelText("to"))

      const from: HTMLInputElement | null =
        document.querySelector("input#from-date")
      const to: HTMLInputElement | null =
        document.querySelector("input#to-date")
      expect(from).toBeNull()
      expect(to).not.toBeNull()
      if (!to) {
        return
      }

      fireEvent.change(to, { target: { value: "2025-01-01" } })

      fireEvent.click(screen.getByRole("button", { name: /add filter/i }))

      expect(
        screen.getByText("Delivery Date: to 2025-01-01"),
      ).toBeInTheDocument()
      expect(router.replace).toHaveBeenCalledOnce()
      expect(router.replace).toHaveBeenCalledWith(
        "?deliveryDate=to%2C2025-01-01",
        { scroll: false },
      )
    })
  })

  describe("list filter", () => {
    it("does happy init render", () => {
      render(<Filter keyOptions={keyOptions} />)
      const selectInput = screen.getByLabelText("Select")
      fireEvent.click(selectInput)

      const option = screen.getByLabelText("Event Type")
      fireEvent.click(option)

      expect(screen.getByText("Filter")).toBeInTheDocument()
      expect(selectInput).toHaveValue("Event Type")
      expect(document.querySelector("input#status-selection")).toHaveValue(
        "Delivered",
      )

      expect(screen.getByLabelText("Successful")).toBeInTheDocument()
      expect(screen.getByLabelText("Failed")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /add filter/i })).toBeEnabled()
    })

    it("adds filter for selected list item with both options true and renders chip", () => {
      render(<Filter keyOptions={keyOptions} />)
      const selectInput = screen.getByLabelText("Select")
      fireEvent.click(selectInput)

      const option = screen.getByLabelText("Event Type")
      fireEvent.click(option)

      fireEvent.click(screen.getByRole("button", { name: /add filter/i }))
      expect(
        screen.getByText("Event Type: Delivered (successful, failed)"),
      ).toBeInTheDocument()
      expect(router.replace).toHaveBeenCalledOnce()
      expect(router.replace).toHaveBeenCalledWith(
        "?eventType=message_delivery%2Cfailed%2Csuccessful",
        { scroll: false },
      )
    })

    it("adds filter for selected list item with successful true, failed false and renders chip", () => {
      render(<Filter keyOptions={keyOptions} />)
      const selectInput = screen.getByLabelText("Select")
      fireEvent.click(selectInput)

      const option = screen.getByLabelText("Event Type")
      fireEvent.click(option)

      fireEvent.click(screen.getByLabelText("Failed"))

      fireEvent.click(screen.getByRole("button", { name: /add filter/i }))
      expect(
        screen.getByText("Event Type: Delivered (successful)"),
      ).toBeInTheDocument()
      expect(router.replace).toHaveBeenCalledOnce()
      expect(router.replace).toHaveBeenCalledWith(
        "?eventType=message_delivery%2Csuccessful",
        { scroll: false },
      )
    })

    it("adds filter for selected list item with successful false, failed true and renders chip", () => {
      render(<Filter keyOptions={keyOptions} />)
      const selectInput = screen.getByLabelText("Select")
      fireEvent.click(selectInput)

      const option = screen.getByLabelText("Event Type")
      fireEvent.click(option)

      fireEvent.click(screen.getByLabelText("Successful"))

      fireEvent.click(screen.getByRole("button", { name: /add filter/i }))
      expect(
        screen.getByText("Event Type: Delivered (failed)"),
      ).toBeInTheDocument()
      expect(router.replace).toHaveBeenCalledOnce()
      expect(router.replace).toHaveBeenCalledWith(
        "?eventType=message_delivery%2Cfailed",
        { scroll: false },
      )
    })

    it("adds filter for selected list item with both options false and renders chip", () => {
      render(<Filter keyOptions={keyOptions} />)
      const selectInput = screen.getByLabelText("Select")
      fireEvent.click(selectInput)

      const option = screen.getByLabelText("Event Type")
      fireEvent.click(option)

      fireEvent.click(screen.getByLabelText("Successful"))
      fireEvent.click(screen.getByLabelText("Failed"))

      fireEvent.click(screen.getByRole("button", { name: /add filter/i }))
      expect(screen.getByText("Event Type: Delivered None")).toBeInTheDocument()
      expect(router.replace).toHaveBeenCalledOnce()
      expect(router.replace).toHaveBeenCalledWith(
        "?eventType=message_delivery",
        { scroll: false },
      )
    })
  })

  it("renders chip correctly with serializable querey params", () => {
    searchParams = createMockSearchParams(
      new URLSearchParams(
        "eventType=message_delivery&eventType=message_option_seen%2Csuccessful",
      ),
    )
    vi.mocked(useSearchParams).mockReturnValue(searchParams)
    render(<Filter keyOptions={keyOptions} />)
    expect(screen.getByText("Event Type: Delivered None")).toBeInTheDocument()
    expect(router.replace).not.toHaveBeenCalled()
  })

  it("renders chip correctly with incorrect serializable querey params", () => {
    searchParams = createMockSearchParams(
      new URLSearchParams(
        "gg=message_delivery&gg=message_option_seen%2Csuccessful",
      ),
    )
    vi.mocked(useSearchParams).mockReturnValue(searchParams)
    render(<Filter keyOptions={keyOptions} />)
    expect(screen.queryByText(/Event Type:/)).not.toBeInTheDocument()
    expect(router.replace).not.toHaveBeenCalled()
  })

  it("callbacks correct url search param when removing the last chip", () => {
    searchParams = createMockSearchParams(
      new URLSearchParams("eventType=message_option_seen%2Csuccessful"),
    )
    vi.mocked(useSearchParams).mockReturnValue(searchParams)
    render(<Filter keyOptions={keyOptions} />)
    expect(
      screen.getByText("Event Type: Seen (successful)"),
    ).toBeInTheDocument()

    const chipParent = screen.getByLabelText(
      /Event Type: Seen \(successful\)\s*/i,
    )

    const chip = within(chipParent).getByRole("button")
    fireEvent.click(chip)

    expect(
      screen.queryByText("Event Type: Seen (successful)"),
    ).not.toBeInTheDocument()
    expect(router.replace).toHaveBeenCalledOnce()
    expect(router.replace).toHaveBeenCalledWith("?")
  })

  it("callbacks correct url search param when removing one of many chips", () => {
    searchParams = createMockSearchParams(
      new URLSearchParams(
        "eventType=message_delivery&eventType=message_option_seen%2Csuccessful",
      ),
    )
    vi.mocked(useSearchParams).mockReturnValue(searchParams)
    render(<Filter keyOptions={keyOptions} />)
    expect(screen.getByText("Event Type: Delivered None")).toBeInTheDocument()
    expect(
      screen.getByText("Event Type: Seen (successful)"),
    ).toBeInTheDocument()

    const chipParent = screen.getByLabelText(
      /chip: Event Type: Delivered None\s*/i,
    )

    const chip = within(chipParent).getByRole("button")
    fireEvent.click(chip)

    expect(
      screen.queryByText("Event Type: Delivered None"),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText("Event Type: Seen (successful)"),
    ).toBeInTheDocument()
    expect(router.replace).toHaveBeenCalledOnce()
    expect(router.replace).toHaveBeenCalledWith(
      "?eventType=message_option_seen%2Csuccessful",
    )
  })
})
