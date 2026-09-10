import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      createTitle: "Create new folder",
      renameTitle: "Rename folder",
      nameLabel: "Folder name",
      placeholder: "Folder name",
      save: "Save",
      cancel: "Cancel",
      close: "Close",
      "error.duplicate": "A folder with this name already exists",
      "error.generic": "Something went wrong. Please try again.",
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
  FormField: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  FormFieldError: ({
    text,
    dataTestid,
  }: {
    text: string
    dataTestid?: string
  }) => <span data-testid={dataTestid}>{text}</span>,
  FormFieldLabel: ({ text, htmlFor }: { text: string; htmlFor: string }) => (
    <label htmlFor={htmlFor}>{text}</label>
  ),
  InputText: ({
    value,
    onChange,
    ...rest
  }: {
    value: string
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  } & Record<string, unknown>) => (
    <input value={value} onChange={onChange} {...rest} />
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
}))

import { FolderFormModal } from "@/components/messages/folder-form-modal"

describe("FolderFormModal", () => {
  it("disables Save until a non-blank name is entered", () => {
    render(
      <FolderFormModal
        isOpen
        mode='create'
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onSuccess={vi.fn()}
      />,
    )

    const save = screen.getByTestId("folder-form-save") as HTMLButtonElement
    expect(save.disabled).toBe(true)

    fireEvent.change(screen.getByTestId("folder-name-input"), {
      target: { value: "Bills" },
    })
    expect(save.disabled).toBe(false)
  })

  it("submits the trimmed name and reports success", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true })
    const onSuccess = vi.fn()
    render(
      <FolderFormModal
        isOpen
        mode='create'
        onClose={vi.fn()}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    )

    fireEvent.change(screen.getByTestId("folder-name-input"), {
      target: { value: "  Bills  " },
    })
    fireEvent.click(screen.getByTestId("folder-form-save"))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("Bills"))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
  })

  it("shows an inline duplicate-name error on conflict", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: false, conflict: true })
    render(
      <FolderFormModal
        isOpen
        mode='create'
        onClose={vi.fn()}
        onSubmit={onSubmit}
        onSuccess={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByTestId("folder-name-input"), {
      target: { value: "EHIC" },
    })
    fireEvent.click(screen.getByTestId("folder-form-save"))

    expect(await screen.findByTestId("folder-name-error")).toHaveTextContent(
      "A folder with this name already exists",
    )
  })

  it("pre-fills the name in rename mode", () => {
    render(
      <FolderFormModal
        isOpen
        mode='rename'
        initialValue='Payslips'
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onSuccess={vi.fn()}
      />,
    )

    expect(screen.getByText("Rename folder")).toBeInTheDocument()
    expect(
      (screen.getByTestId("folder-name-input") as HTMLInputElement).value,
    ).toBe("Payslips")
  })
})
