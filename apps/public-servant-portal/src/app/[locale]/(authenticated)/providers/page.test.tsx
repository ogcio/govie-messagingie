import { render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"

vi.mock("@/components/providers/providers-page-client", () => ({
  ProvidersPageClient: () => <div data-testid='providers-page-client' />,
}))

import ProvidersPage from "./page"

it("renders the providers client view through Suspense", () => {
  render(<ProvidersPage />)
  expect(screen.getByTestId("providers-page-client")).toBeInTheDocument()
})
