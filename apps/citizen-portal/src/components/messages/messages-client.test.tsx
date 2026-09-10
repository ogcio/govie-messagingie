import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("./unified-inbox", () => ({
  UnifiedInboxPage: () => <main>Inbox</main>,
}))

import { MessagesPageClient } from "./messages-client"

describe("MessagesPageClient", () => {
  it("renders the unified inbox", () => {
    render(<MessagesPageClient />)

    expect(screen.getByRole("main")).toHaveTextContent("Inbox")
  })
})
