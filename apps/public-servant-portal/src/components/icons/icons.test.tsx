import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AddCircleIcon } from "./add-circle"
import { CheckboxIndicatorIcon } from "./checkbox-indicator"
import { DeleteIcon } from "./delete"
import { SearchIcon } from "./search"

describe("inline icons", () => {
  it.each([
    ["add", <AddCircleIcon size='sm' />],
    ["delete", <DeleteIcon size='lg' />],
    ["search", <SearchIcon />],
  ])("renders the %s icon as decorative SVG", (_name, icon) => {
    const { container } = render(icon)
    const svg = container.querySelector("svg")
    expect(svg).toHaveAttribute("aria-hidden", "true")
    expect(svg?.querySelector("path")).toBeInTheDocument()
  })

  it("renders checkbox checked and indeterminate contracts", () => {
    const { container, rerender } = render(<CheckboxIndicatorIcon checked />)
    expect(container.querySelector("polyline")).toBeInTheDocument()

    rerender(<CheckboxIndicatorIcon checked indeterminate />)
    expect(container.querySelector("line")).toBeInTheDocument()
    expect(container.querySelector("polyline")).not.toBeInTheDocument()
  })
})
