import { render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"

vi.mock("@/components/providers/email-provider-form-client", () => ({
  EmailProviderFormClient: () => <div data-testid='email-provider-form' />,
}))

import EmailProviderPage from "./page"

it("renders the email provider form through Suspense", () => {
  render(<EmailProviderPage />)
  expect(screen.getByTestId("email-provider-form")).toBeInTheDocument()
})
