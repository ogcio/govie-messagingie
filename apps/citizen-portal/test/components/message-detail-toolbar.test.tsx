import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MessageDetailToolbar } from "@/components/messages/message-detail-toolbar"

vi.mock("@ogcio/design-system-react", () => ({
  Icon: () => null,
  Link: ({
    children,
    onClick,
    ...rest
  }: {
    children: React.ReactNode
    onClick?: (e: React.MouseEvent) => void
  } & Record<string, unknown>) => (
    <a href='#' onClick={onClick} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const byNamespace: Record<string, Record<string, string>> = {
      "home.button": { back: "Back" },
      "home.move": { toolbar: "Move" },
      "home.detail": {
        delete: "Delete",
        toolbarAriaLabel: "Message actions",
      },
    }
    return byNamespace[namespace]?.[key] ?? key
  },
}))

describe("MessageDetailToolbar", () => {
  const onMove = vi.fn()
  const onDelete = vi.fn()
  const backHref = "/en/messages"

  beforeEach(() => {
    onMove.mockReset()
    onDelete.mockReset()
  })

  it("renders back, move, and delete actions", () => {
    render(
      <MessageDetailToolbar
        backHref={backHref}
        onMove={onMove}
        onDelete={onDelete}
      />,
    )

    expect(
      screen.getByRole("navigation", { name: "Message actions" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back" })).toBeInTheDocument()
    expect(screen.getByTestId("detail-move-button")).toHaveTextContent("Move")
    expect(screen.getByTestId("detail-delete-button")).toHaveTextContent(
      "Delete",
    )
  })

  it("calls onMove and onDelete when action buttons are clicked", () => {
    render(
      <MessageDetailToolbar
        backHref={backHref}
        onMove={onMove}
        onDelete={onDelete}
      />,
    )

    fireEvent.click(screen.getByTestId("detail-move-button"))
    fireEvent.click(screen.getByTestId("detail-delete-button"))

    expect(onMove).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it("disables move and delete while an action is in progress", () => {
    render(
      <MessageDetailToolbar
        backHref={backHref}
        onMove={onMove}
        onDelete={onDelete}
        isDeleting
      />,
    )

    expect(screen.getByTestId("detail-move-button")).toHaveAttribute(
      "aria-disabled",
      "true",
    )
    expect(screen.getByTestId("detail-delete-button")).toHaveAttribute(
      "aria-disabled",
      "true",
    )
  })

  it("links Back to the parent page href", () => {
    render(
      <MessageDetailToolbar
        backHref='/en/my-applications?id=SCH-2025-073296'
        onMove={onMove}
        onDelete={onDelete}
      />,
    )

    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      "/en/my-applications?id=SCH-2025-073296",
    )
  })
})
