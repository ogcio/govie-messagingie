import { render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"

vi.mock("@/components/message-events/message-events-page-client", () => ({
  MessageEventsPageClient: () => <div data-testid='message-events-client' />,
}))

import MessageEventsPage from "./page"

it("renders the message events client view through Suspense", () => {
  render(<MessageEventsPage />)
  expect(screen.getByTestId("message-events-client")).toBeInTheDocument()
})
