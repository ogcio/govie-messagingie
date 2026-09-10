import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  result: {
    submission: undefined as
      | {
          id: string
          title: { en: string }
          description: { en: string }
          status: "completed"
          createdAt: string
          submittedAt?: string
        }
      | undefined,
    isLoading: false,
    error: null as Error | null,
  },
}))

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/my-submissions",
}))
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}))
vi.mock("./use-submissions", () => ({
  useSubmission: () => state.result,
}))
vi.mock("@ogcio/design-system-react", () => ({
  Heading: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  Paragraph: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))
vi.mock("./submission-detail-toolbar", () => ({
  SubmissionDetailToolbar: ({ backHref }: { backHref: string }) => (
    <a href={backHref}>Back</a>
  ),
}))
vi.mock("./submission-status-tag", () => ({
  SubmissionStatusTag: ({ status }: { status: string }) => <span>{status}</span>,
}))
vi.mock("./submission-related-messages", () => ({
  SubmissionRelatedMessages: ({
    submissionId,
    submissionTitle,
  }: {
    submissionId: string
    submissionTitle: string
  }) => <div>{`related:${submissionId}:${submissionTitle}`}</div>,
}))

import { SubmissionDetailView } from "./submission-detail-view"

describe("SubmissionDetailView", () => {
  beforeEach(() => {
    state.result = { submission: undefined, isLoading: false, error: null }
  })

  it("announces loading while the submission is fetched", () => {
    state.result.isLoading = true
    render(<SubmissionDetailView id='submission-1' />)
    expect(screen.getByLabelText("loading")).toBeInTheDocument()
  })

  it("shows the error and a route back to the list", () => {
    state.result.error = new Error("Submission unavailable")
    render(<SubmissionDetailView id='submission-1' />)
    expect(screen.getByText("Submission unavailable")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      "/en/my-submissions",
    )
  })

  it("renders the localized submission fields and related messages", () => {
    state.result.submission = {
      id: "submission-1",
      title: { en: "Housing support" },
      description: { en: "Apply for support" },
      status: "completed",
      createdAt: "2026-01-01T00:00:00Z",
      submittedAt: "2026-01-02T00:00:00Z",
    }
    render(<SubmissionDetailView id='submission-1' />)
    expect(screen.getByRole("heading", { name: "heading" })).toBeInTheDocument()
    expect(screen.getByText("Housing support")).toBeInTheDocument()
    expect(screen.getByText("Apply for support")).toBeInTheDocument()
    expect(
      screen.getByText("related:submission-1:Housing support"),
    ).toBeInTheDocument()
    expect(screen.getByText("submittedDate")).toBeInTheDocument()
  })
})
