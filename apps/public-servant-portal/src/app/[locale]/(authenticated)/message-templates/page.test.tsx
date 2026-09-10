import { render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"

vi.mock("@/components/message-templates/message-templates-page-client", () => ({
  MessageTemplatesPageClient: () => (
    <div data-testid='message-templates-page-client' />
  ),
}))

import MessageTemplatesPage from "./page"

it("renders the message templates client view through Suspense", () => {
  render(<MessageTemplatesPage />)
  expect(
    screen.getByTestId("message-templates-page-client"),
  ).toBeInTheDocument()
})
