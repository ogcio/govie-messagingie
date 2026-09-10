import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import Page from "./page"

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  use: () => ({ locale: "ga" }),
}))

vi.mock("@/components/messages/messages-page-content", () => ({
  MessagesPageContent: ({ locale }: { locale: string }) => (
    <div>Messages locale: {locale}</div>
  ),
}))

describe("messages page", () => {
  it("passes the route locale to the messages view", () => {
    render(<Page params={Promise.resolve({ locale: "ga" })} />)

    expect(screen.getByText("Messages locale: ga")).toBeInTheDocument()
  })
})
