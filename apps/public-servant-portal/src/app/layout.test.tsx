import { render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"

vi.mock("next/font/google", () => ({
  Lato: () => ({ variable: "lato-variable" }),
}))

vi.mock("@/components/frontend-observability", () => ({
  default: () => <div data-testid='frontend-observability' />,
}))

import RootLayout from "./layout"

it("renders the document shell, observability, and children", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

  render(
    <RootLayout>
      <main>Page content</main>
    </RootLayout>,
  )

  expect(document.documentElement).toHaveClass("lato-variable")
  expect(screen.getByTestId("frontend-observability")).toBeInTheDocument()
  expect(screen.getByRole("main")).toHaveTextContent("Page content")
  consoleError.mockRestore()
})
