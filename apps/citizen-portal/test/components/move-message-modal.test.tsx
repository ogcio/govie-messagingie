import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      title: "Move message(s)",
      chooseFolder: "Choose a folder to move to",
      move: "Move",
      cancel: "Cancel",
      close: "Close",
      noFolders: "No folders",
    }
    return map[key] ?? key
  },
}))

vi.mock("@ogcio/design-system-react", () => ({
  Button: ({
    children,
    onClick,
    ...rest
  }: {
    children: React.ReactNode
    onClick?: () => void
  } & Record<string, unknown>) => (
    <button type='button' onClick={onClick} {...rest}>
      {children}
    </button>
  ),
  FormField: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  FormFieldLabel: ({ text, htmlFor }: { text: string; htmlFor: string }) => (
    <label htmlFor={htmlFor}>{text}</label>
  ),
  ModalBody: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ModalFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ModalTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  ModalWrapper: ({
    children,
    isOpen,
    dataTestId,
  }: {
    children: React.ReactNode
    isOpen: boolean
    dataTestId?: string
  }) => (isOpen ? <div data-testid={dataTestId}>{children}</div> : null),
  Paragraph: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode
    value: string
  }) => <option value={value}>{children}</option>,
  SelectNative: ({
    children,
    value,
    onChange,
    ...rest
  }: {
    children: React.ReactNode
    value: string
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  } & Record<string, unknown>) => (
    <select value={value} onChange={onChange} {...rest}>
      {children}
    </select>
  ),
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { MoveMessageModal } from "@/components/messages/move-message-modal"

const destinations = [
  { id: "mock-folder-ehic", label: "EHIC" },
  { id: "mock-folder-payslips", label: "Payslips" },
]

describe("MoveMessageModal", () => {
  it("lists mock folders excluding the current folder", () => {
    render(
      <MoveMessageModal
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        destinations={destinations.filter((d) => d.id !== "mock-folder-ehic")}
      />,
    )

    expect(screen.getByTestId("move-folder-select")).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Payslips" })).toBeInTheDocument()
    expect(
      screen.queryByRole("option", { name: "EHIC" }),
    ).not.toBeInTheDocument()
  })

  it("includes Inbox when message is in a folder", () => {
    render(
      <MoveMessageModal
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        destinations={[
          { id: null, label: "Inbox" },
          { id: "mock-folder-payslips", label: "Payslips" },
        ]}
      />,
    )

    expect(screen.getByRole("option", { name: "Inbox" })).toBeInTheDocument()
  })

  it("calls onConfirm with selected folder on desktop Move click", () => {
    const onConfirm = vi.fn()
    render(
      <MoveMessageModal
        isOpen
        onClose={vi.fn()}
        onConfirm={onConfirm}
        destinations={destinations}
      />,
    )

    fireEvent.change(screen.getByTestId("move-folder-select"), {
      target: { value: "mock-folder-payslips" },
    })
    fireEvent.click(screen.getByTestId("move-confirmation-confirm"))

    expect(onConfirm).toHaveBeenCalledWith("mock-folder-payslips")
  })
})
