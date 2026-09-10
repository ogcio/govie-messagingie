import { render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"

vi.mock("@/components/profile-admin/service-users/edit-service-user", () => ({
  EditServiceUser: () => <div data-testid='edit-service-user' />,
}))

import EditServiceUserPage from "./page"

it("renders the service user editor through Suspense", () => {
  render(<EditServiceUserPage />)
  expect(screen.getByTestId("edit-service-user")).toBeInTheDocument()
})
