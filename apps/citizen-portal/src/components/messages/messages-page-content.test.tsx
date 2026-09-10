import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const setRequestLocale = vi.hoisted(() => vi.fn())

vi.mock("next-intl/server", () => ({ setRequestLocale }))
vi.mock("./messages-client", () => ({
  MessagesPageClient: () => <main>Messages</main>,
}))

import { MessagesPageContent } from "./messages-page-content"

describe("MessagesPageContent", () => {
  it("sets the request locale and renders the client inbox", () => {
    render(<MessagesPageContent locale='ga' />)

    expect(setRequestLocale).toHaveBeenCalledWith("ga")
    expect(screen.getByRole("main")).toHaveTextContent("Messages")
  })
})
