import { render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"

vi.mock("@/components/message-events/message-event-detail-client", () => ({
  MessageEventDetailClient: () => <div data-testid='message-event-detail' />,
}))

import MessageEventDetailPage from "./page"

it("renders the message event detail through Suspense", () => {
  render(<MessageEventDetailPage />)
  expect(screen.getByTestId("message-event-detail")).toBeInTheDocument()
})
