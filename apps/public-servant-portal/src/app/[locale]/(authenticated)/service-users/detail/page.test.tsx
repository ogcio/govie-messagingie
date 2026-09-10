import { render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"

vi.mock("@/components/profile-admin/service-users/service-user", () => ({
  ServiceUser: () => <div data-testid='service-user-detail' />,
}))

import ServiceUserDetailPage from "./page"

it("renders the service user detail through Suspense", () => {
  render(<ServiceUserDetailPage />)
  expect(screen.getByTestId("service-user-detail")).toBeInTheDocument()
})
