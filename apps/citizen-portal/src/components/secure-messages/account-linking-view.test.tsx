import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string) => key
    t.rich = (key: string) => key
    return t
  },
}))

vi.mock("@ogcio/design-system-react", () => ({
  Heading: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  Paragraph: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("./profile-match-info", () => ({
  ProfileMatchInfo: ({
    currentEmail,
    matchedEmail,
  }: {
    currentEmail: string
    matchedEmail: string
  }) => (
    <div
      data-testid='profile-match'
      data-current-email={currentEmail}
      data-matched-email={matchedEmail}
    />
  ),
}))
vi.mock("./report-button", () => ({
  ReportButton: () => <button type='button'>report action</button>,
}))
vi.mock("./confirm-button", () => ({
  ConfirmButton: ({
    currentUserId,
    targetUserId,
    messageId,
  }: Record<string, string>) => (
    <button
      type='button'
      data-testid='confirm-action'
      data-current-user-id={currentUserId}
      data-target-user-id={targetUserId}
      data-message-id={messageId}
    >
      confirm action
    </button>
  ),
}))

import { AccountLinkingView } from "./account-linking-view"

describe("AccountLinkingView", () => {
  it("presents both profiles and passes linking identifiers to the actions", () => {
    render(
      <AccountLinkingView
        currentProfile={{
          id: "current-id",
          email: "current@example.ie",
          primaryUserId: "current-id",
        }}
        linkedProfile={{
          id: "linked-id",
          email: "linked@example.ie",
          primaryUserId: "linked-id",
        }}
        messageId='message-id'
      />,
    )

    expect(screen.getByRole("heading", { name: "title" })).toBeInTheDocument()
    expect(screen.getByText("description")).toBeInTheDocument()
    expect(screen.getByText("footer")).toBeInTheDocument()
    expect(screen.getByTestId("profile-match")).toHaveAttribute(
      "data-current-email",
      "current@example.ie",
    )
    expect(screen.getByTestId("profile-match")).toHaveAttribute(
      "data-matched-email",
      "linked@example.ie",
    )
    expect(screen.getByTestId("confirm-action")).toHaveAttribute(
      "data-current-user-id",
      "current-id",
    )
    expect(screen.getByTestId("confirm-action")).toHaveAttribute(
      "data-target-user-id",
      "linked-id",
    )
    expect(screen.getByTestId("confirm-action")).toHaveAttribute(
      "data-message-id",
      "message-id",
    )
    expect(
      screen.getByRole("button", { name: "report action" }),
    ).toBeInTheDocument()
  })
})
