import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { folder?: string }) => {
    const map: Record<string, string> = {
      "deleteConfirm.title": `Delete ${values?.folder ?? ""}?`,
      "deleteConfirm.body":
        "Messages in this folder will be moved back to your inbox.",
      "deleteConfirm.cta": "Delete",
      "deleteConfirm.cancel": "Cancel",
      close: "Close",
    }
    return map[key] ?? key
  },
}))

vi.mock("@ogcio/design-system-react", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...rest
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
  } & Record<string, unknown>) => (
    <button type='button' onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
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
  Paragraph: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

import { DeleteFolderModal } from "@/components/messages/delete-folder-modal"

describe("DeleteFolderModal", () => {
  it("warns that messages return to the inbox and confirms deletion", () => {
    const onConfirm = vi.fn()
    render(
      <DeleteFolderModal
        isOpen
        folderName='EHIC'
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    expect(screen.getByText("Delete EHIC?")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Messages in this folder will be moved back to your inbox.",
      ),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByTestId("delete-folder-confirm"))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it("cancels without confirming", () => {
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    render(
      <DeleteFolderModal
        isOpen
        folderName='EHIC'
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    )

    fireEvent.click(screen.getByTestId("delete-folder-cancel"))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
