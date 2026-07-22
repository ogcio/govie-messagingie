import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ListCard } from "@/components/list-card/list-card"

describe("ListCard", () => {
  it("renders title, date, and preview", () => {
    render(
      <ListCard
        title='Department of Education'
        date={<time dateTime='2026-07-02'>2 Jul 2026</time>}
        preview='Please find attached your payslip for the month of August.'
      />,
    )

    expect(screen.getByText("Department of Education")).toBeInTheDocument()
    expect(screen.getByText("2 Jul 2026")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Please find attached your payslip for the month of August.",
      ),
    ).toBeInTheDocument()
  })

  it("shows the checkbox indicator in selection mode", () => {
    render(
      <ListCard
        title='Sender'
        date='2 Jul 2026'
        preview='Preview'
        showCheckbox
        isChecked
        checkboxTestId='list-card-checkbox'
      />,
    )

    const button = screen.getByRole("button")
    expect(button).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByTestId("list-card-checkbox")).toBeInTheDocument()
  })

  it("hides the attachment icon when hasAttachment is false", () => {
    render(
      <ListCard title='Sender' date='2 Jul 2026' preview='Preview' />,
    )

    expect(screen.queryByLabelText("Has attachment")).not.toBeInTheDocument()
  })

  it("shows the attachment icon when hasAttachment is true", () => {
    render(
      <ListCard
        title='Sender'
        date='2 Jul 2026'
        preview='Preview'
        hasAttachment
        attachmentAriaLabel='1 attachment'
      />,
    )

    expect(screen.getByLabelText("1 attachment")).toBeInTheDocument()
  })

  it("calls onClick when activated", () => {
    const onClick = vi.fn()
    render(
      <ListCard
        title='Sender'
        date='2 Jul 2026'
        preview='Preview'
        onClick={onClick}
      />,
    )

    fireEvent.click(screen.getByRole("button"))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
