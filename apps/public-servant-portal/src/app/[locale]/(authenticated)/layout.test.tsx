import { render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"

vi.mock("@/components/authenticated-shell-dispatcher", () => ({
  AuthenticatedShellDispatcher: ({
    children,
  }: {
    children: React.ReactNode
  }) => <div data-testid='authenticated-shell'>{children}</div>,
}))

import AuthenticatedLayout from "./layout"

it("delegates its children to the authenticated shell", () => {
  render(
    <AuthenticatedLayout>
      <span>Protected page</span>
    </AuthenticatedLayout>,
  )

  expect(screen.getByTestId("authenticated-shell")).toHaveTextContent(
    "Protected page",
  )
})
