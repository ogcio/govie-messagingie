import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const replace = vi.fn()
let searchParams = new URLSearchParams()

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/messages",
  useRouter: () => ({ replace }),
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock("@/hooks/use-url-search-params", () => ({
  useUrlSearchParams: () => searchParams,
}))

vi.mock("@/components/css-spinner", () => ({
  CssSpinner: () => <span>Loading</span>,
}))

vi.mock("@ogcio/design-system-react", () => ({
  InputText: ({
    iconEnd,
    clearButtonEnabled: _clearButtonEnabled,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & {
    iconEnd?: React.ReactNode
    clearButtonEnabled?: boolean
  }) => (
    <>
      <input {...props} />
      {iconEnd}
    </>
  ),
}))

import { InboxListSearchField } from "./inbox-list-search-field"

describe("InboxListSearchField", () => {
  beforeEach(() => {
    searchParams = new URLSearchParams("page=4")
    window.history.replaceState(null, "", "/en/messages?page=4")
  })

  it("submits trimmed search immediately on Enter and resets pagination", () => {
    render(<InboxListSearchField />)
    const input = screen.getByRole("textbox", { name: "button.search" })

    fireEvent.change(input, { target: { value: "  tax return  " } })
    expect(input).toHaveAttribute("aria-busy", "true")
    expect(screen.getByTestId("search-pending-spinner")).toBeInTheDocument()
    fireEvent.keyDown(input, { key: "Enter" })

    expect(window.location.pathname + window.location.search).toBe(
      "/en/messages?search=tax+return",
    )
  })

  it("syncs its value when URL search state changes", () => {
    searchParams = new URLSearchParams("search=first")
    const { rerender } = render(<InboxListSearchField />)
    expect(screen.getByRole("textbox")).toHaveValue("first")

    searchParams = new URLSearchParams("search=second")
    rerender(<InboxListSearchField searchInputTestId='updated-search' />)
    expect(screen.getByRole("textbox")).toHaveValue("second")
  })
})
