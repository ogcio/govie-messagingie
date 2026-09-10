import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import PaginationWrapper from "./PaginationWrapper"
import SideNav from "./SideNav"
import { SubmitButton } from "./SubmitButton"

const { push, useFormStatus, searchParams } = vi.hoisted(() => ({
  push: vi.fn(),
  useFormStatus: vi.fn(),
  searchParams: new URLSearchParams("page=1&size=25&search=term"),
}))

vi.mock("react-dom", () => ({ useFormStatus }))
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/message-templates/one",
  useRouter: () => ({ push }),
  useSearchParams: () => searchParams,
}))
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}))
vi.mock("@ogcio/design-system-react", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Spinner: () => <span data-testid='spinner' />,
  Pagination: ({
    currentPage,
    totalPages,
    onPageChange,
  }: {
    currentPage: number
    totalPages: number
    onPageChange: (page: number) => void
  }) => (
    <button type='button' onClick={() => onPageChange(3)}>
      Page {currentPage} of {totalPages}
    </button>
  ),
  SideNav: ({
    children,
    value,
    onChange,
  }: {
    children: ReactNode
    value: string
    onChange: (value: string) => void
  }) => (
    <nav data-value={value}>
      {children}
      <button type='button' onClick={() => onChange("/en/help")}>
        Navigate
      </button>
    </nav>
  ),
  SideNavItem: ({ label, value }: { label: string; value: string }) => (
    <span data-value={value}>{label}</span>
  ),
}))

describe("form and navigation components", () => {
  beforeEach(() => {
    push.mockClear()
    useFormStatus.mockReturnValue({ pending: false })
  })

  it("keeps existing query parameters when pagination changes", () => {
    render(<PaginationWrapper currentPage={1} totalPages={5} size={10} />)
    fireEvent.click(screen.getByRole("button", { name: "Page 2 of 5" }))
    expect(push).toHaveBeenCalledWith("?page=2&size=25&search=term")
  })

  it("marks the current section and navigates from the side navigation", () => {
    const { container } = render(<SideNav />)
    expect(container.querySelector("nav")).toHaveAttribute(
      "data-value",
      "/en/message-templates",
    )
    fireEvent.click(screen.getByRole("button", { name: "Navigate" }))
    expect(push).toHaveBeenCalledWith("/en/help")
    expect(screen.getByText("sendMessage")).toBeInTheDocument()
  })

  it("disables the submit button and shows a spinner while pending", () => {
    useFormStatus.mockReturnValue({ pending: true })
    render(<SubmitButton className='action'>Save</SubmitButton>)
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
    expect(screen.getByRole("button")).toHaveClass("action")
    expect(screen.getByTestId("spinner")).toBeInTheDocument()
  })
})
