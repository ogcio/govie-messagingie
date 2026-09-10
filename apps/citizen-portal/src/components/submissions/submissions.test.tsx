import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const searchParams = vi.hoisted(() => new URLSearchParams())

vi.mock("@/hooks/use-url-search-params", () => ({
  useUrlSearchParams: () => searchParams,
}))
vi.mock("./submission-detail-view", () => ({
  SubmissionDetailView: ({ id }: { id: string }) => <div>detail:{id}</div>,
}))
vi.mock("./submission-list-view", () => ({
  SubmissionListView: () => <div>submission list</div>,
}))

import { SubmissionsPage } from "./submissions"

describe("SubmissionsPage", () => {
  it("shows the list when no submission is selected", () => {
    searchParams.delete("id")
    render(<SubmissionsPage />)
    expect(screen.getByText("submission list")).toBeInTheDocument()
  })

  it("shows the selected submission detail", () => {
    searchParams.set("id", "submission-42")
    render(<SubmissionsPage />)
    expect(screen.getByText("detail:submission-42")).toBeInTheDocument()
  })
})
