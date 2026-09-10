import { fireEvent, render, screen } from "@testing-library/react"
import type { MouseEventHandler, ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { BackButton } from "./back-button"

vi.mock("next-intl", () => ({
  useTranslations: () => () => "Back",
}))

vi.mock("@ogcio/design-system-react", () => ({
  Link: ({
    href,
    children,
    onClick,
  }: {
    href: string
    children: ReactNode
    onClick: MouseEventHandler<HTMLAnchorElement>
  }) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
}))

describe("BackButton", () => {
  it("uses browser history instead of navigating to the hash", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {})
    render(<BackButton />)

    fireEvent.click(screen.getByRole("link", { name: "Back" }))

    expect(back).toHaveBeenCalledOnce()
    back.mockRestore()
  })
})
