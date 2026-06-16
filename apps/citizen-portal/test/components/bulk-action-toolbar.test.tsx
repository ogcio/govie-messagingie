import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { BulkActionToolbar } from "@/components/messages/bulk-action-toolbar"

vi.mock("next-intl", () => ({
  useTranslations:
    (_namespace: string) =>
    (key: string, params?: { [k: string]: string | number }) => {
      if (key === "selectedCount") {
        const count = Number(params?.count) || 0
        return `${count} selected`
      }
      if (key === "delete") return "Delete"
      if (key === "ariaLabel") return "Bulk actions"
      return key
    },
}))

describe("BulkActionToolbar", () => {
  it("renders nothing when no messages are selected", () => {
    const { container } = render(
      <BulkActionToolbar selectedCount={0} onDelete={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("renders the selected count and triggers delete", () => {
    const onDelete = vi.fn()
    render(<BulkActionToolbar selectedCount={3} onDelete={onDelete} />)

    expect(screen.getByText("3 selected")).toBeInTheDocument()
    fireEvent.click(screen.getByTestId("bulk-delete-button"))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it("renders extra actions alongside Delete", () => {
    render(
      <BulkActionToolbar
        selectedCount={1}
        onDelete={vi.fn()}
        extraActions={<span data-testid='extra-slot'>Move to</span>}
      />,
    )
    expect(screen.getByTestId("extra-slot")).toBeInTheDocument()
  })
})
