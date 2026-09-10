import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { CheckboxIndicatorIcon } from "./checkbox-indicator"
import { SearchIcon } from "./search"

describe("icons", () => {
  it("renders SearchIcon at the requested size", () => {
    const { container } = render(<SearchIcon size='lg' className='search' />)
    const icon = container.querySelector("svg")

    expect(icon).toHaveAttribute("width", "32")
    expect(icon).toHaveAttribute("height", "32")
    expect(icon).toHaveAttribute("aria-hidden", "true")
    expect(icon).toHaveClass("search")
  })

  it("renders the selected and indeterminate checkbox marks", () => {
    const { container, rerender } = render(
      <CheckboxIndicatorIcon checked data-testid='checkbox' />,
    )
    expect(container.querySelector("polyline")).toBeInTheDocument()

    rerender(<CheckboxIndicatorIcon checked indeterminate />)
    expect(container.querySelector("line")).toBeInTheDocument()
    expect(container.querySelector("polyline")).not.toBeInTheDocument()
  })
})
