import { fireEvent, render, screen, within } from "@testing-library/react"
import {
  type ReadonlyURLSearchParams,
  useRouter,
  useSearchParams,
} from "next/navigation"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ClientFilterKeyOption } from "@/utils/appliedFilter.types"
import Filter from "./Filter"

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

describe("Profiles Filter component", () => {
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
    {
      label: "Cheese",
      type: "text",
      value: "cheese",
    },
  ]

  it("does happy init render", () => {
    render(<Filter keyOptions={keyOptions} />)
    expect(screen.getByText("Filter")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Search")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /add filter/i })).toBeDisabled()
  })

  it("it happy renders text selection", () => {
    render(<Filter keyOptions={keyOptions} />)
    const selectInput = screen.getByLabelText("Select")
    fireEvent.click(selectInput)

    const option = screen.getByText("Cheese")
    fireEvent.click(option)

    expect(screen.getByText("Filter")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Search")).toBeInTheDocument()
    expect(selectInput).toHaveValue("Cheese")
    expect(screen.getByRole("button", { name: /add filter/i })).toBeEnabled()
  })

  it("adds filter with text submitted and renders chip", () => {
    render(<Filter keyOptions={keyOptions} />)
    const selectInput = screen.getByLabelText("Select")
    fireEvent.click(selectInput)

    const option = screen.getByText("Cheese")
    fireEvent.click(option)

    const input: HTMLInputElement | null =
      document.querySelector("input#text-search")
    expect(input).not.toBeNull()
    if (!input) {
      return
    }

    fireEvent.change(input, { target: { value: "Camembert" } })
    fireEvent.click(screen.getByRole("button", { name: /add filter/i }))

    expect(screen.getByText("Cheese: Camembert")).toBeInTheDocument()
    expect(router.replace).toHaveBeenCalledOnce()
    expect(router.replace).toHaveBeenCalledWith("?cheese=Camembert", {
      scroll: false,
    })
  })

  it("callbacks correct url when removing a chip", () => {
    render(<Filter keyOptions={keyOptions} />)
    const selectInput = screen.getByLabelText("Select")
    fireEvent.click(selectInput)

    const option = screen.getByText("Cheese")
    fireEvent.click(option)

    const input: HTMLInputElement | null =
      document.querySelector("input#text-search")
    expect(input).not.toBeNull()
    if (!input) {
      return
    }

    fireEvent.change(input, { target: { value: "Camembert" } })
    fireEvent.click(screen.getByRole("button", { name: /add filter/i }))

    expect(screen.getByText("Cheese: Camembert")).toBeInTheDocument()

    const chipParent = screen.getByLabelText(/Cheese: Camembert\s*/i)

    const chip = within(chipParent).getByRole("button")
    fireEvent.click(chip)

    expect(screen.queryByText("Cheese: Camembert")).not.toBeInTheDocument()
    expect(router.replace).lastCalledWith("?")
  })
})
