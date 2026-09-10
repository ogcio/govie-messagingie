import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@ogcio/design-system-react", () => ({
  Paragraph: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { ProfileMatchInfo } from "./profile-match-info"

describe("ProfileMatchInfo", () => {
  it("shows the current account and masks the matched account", () => {
    render(
      <ProfileMatchInfo
        currentEmail='current@example.ie'
        matchedEmail='candidate@example.ie'
      />,
    )

    expect(screen.getByText("My Gov Id:")).toBeInTheDocument()
    expect(screen.getByText("current@example.ie")).toBeInTheDocument()
    expect(screen.getByText("Registered Email:")).toBeInTheDocument()
    expect(screen.getByText("c•••••••e@example.ie")).toBeInTheDocument()
    expect(screen.queryByText("candidate@example.ie")).not.toBeInTheDocument()
  })
})
