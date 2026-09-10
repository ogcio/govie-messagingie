import { render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"

vi.mock("@/components/profile-admin/service-users/service-user-import", () => ({
  ServiceUserImport: () => <div data-testid='service-user-import' />,
}))

import ServiceUserImportPage from "./page"

it("renders the service user import through Suspense", () => {
  render(<ServiceUserImportPage />)
  expect(screen.getByTestId("service-user-import")).toBeInTheDocument()
})
