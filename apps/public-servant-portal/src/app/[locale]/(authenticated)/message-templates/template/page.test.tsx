import { render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"

vi.mock("@/components/message-templates/message-template-form-client", () => ({
  MessageTemplateFormClient: () => (
    <div data-testid='message-template-form-client' />
  ),
}))

import MessageTemplateEditPage from "./page"

it("renders the template form through Suspense", () => {
  render(<MessageTemplateEditPage />)
  expect(screen.getByTestId("message-template-form-client")).toBeInTheDocument()
})
