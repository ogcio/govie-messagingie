import { render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"

vi.mock("@/components/profile-admin/service-users/service-users", () => ({
  ServiceUsers: () => <div data-testid='service-users' />,
}))

import ServiceUsersPage from "./page"

it("renders the service users view", () => {
  render(<ServiceUsersPage />)
  expect(screen.getByTestId("service-users")).toBeInTheDocument()
})
