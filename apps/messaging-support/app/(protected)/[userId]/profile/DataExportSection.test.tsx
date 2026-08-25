import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useRouter } from "next/navigation"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ExportTask, MainProfile } from "@/data/types"
import { requestDataExportAction } from "@/utils/actions"
import { DataExportSection } from "./DataExportSection"

vi.mock("@/utils/actions", () => ({
  requestDataExportAction: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@ogcio/nextjs-analytics", () => ({
  useAnalytics: () => ({ trackEvent: vi.fn() }),
}))

vi.mock("@ogcio/design-system-react", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  toaster: { create: vi.fn() },
}))

const profile = {
  id: "profile-1",
  publicName: "A B",
  firstName: "A",
  lastName: "B",
  email: "a@b.test",
  status: "active",
} as unknown as MainProfile

function renderSection(exportTask: ExportTask | null, loadFailed = false) {
  return render(
    <DataExportSection
      profile={profile}
      exportTask={exportTask}
      loadFailed={loadFailed}
    />,
  )
}

function completeTheGate() {
  fireEvent.click(screen.getByRole("button", { name: /request data export/i }))
  for (const checkbox of screen.getAllByRole("checkbox")) {
    fireEvent.click(checkbox)
  }
}

describe("DataExportSection", () => {
  const mockRefresh = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useRouter).mockReturnValue({
      refresh: mockRefresh,
    } as unknown as ReturnType<typeof useRouter>)
  })

  it("offers the request button when there is no export task", () => {
    renderSection(null)

    expect(
      screen.getByRole("button", { name: /request data export/i }),
    ).toBeInTheDocument()
  })

  it("reports an in-progress export and hides the request button", () => {
    renderSection({ id: "task-1", status: "processing", metadata: null })

    expect(screen.getByText(/export is in progress/i)).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /request data export/i }),
    ).not.toBeInTheDocument()
  })

  it("shows the expiry date for a completed, unexpired export", () => {
    const expiresAt = new Date(
      Date.now() + 10 * 24 * 60 * 60 * 1000,
    ).toISOString()
    renderSection({
      id: "task-1",
      status: "completed",
      metadata: { expiresAt, uploadId: "upload-1" },
    })

    expect(
      screen.getByText(/available to the citizen until/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /request data export/i }),
    ).toBeInTheDocument()
  })

  it("reports a failed export", () => {
    renderSection({ id: "task-1", status: "failed", metadata: null })

    expect(screen.getByText(/last export failed/i)).toBeInTheDocument()
  })

  it("warns when the export status could not be loaded", () => {
    renderSection(null, true)

    expect(
      screen.getByText(/could not load the export status/i),
    ).toBeInTheDocument()
  })

  it("pins the consent copy warning the agent that the citizen will not be notified", () => {
    renderSection(null)

    fireEvent.click(
      screen.getByRole("button", { name: /request data export/i }),
    )

    expect(
      screen.getByText("I understand the citizen will not be notified"),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Any export they currently hold is replaced and its download link stops working.",
      ),
    ).toBeInTheDocument()
  })

  it("keeps confirm disabled until every checkbox is ticked", () => {
    renderSection(null)

    fireEvent.click(
      screen.getByRole("button", { name: /request data export/i }),
    )

    const checkboxes = screen.getAllByRole("checkbox")
    expect(checkboxes).toHaveLength(3)

    const confirm = screen.getByRole("button", { name: /^confirm export$/i })
    expect(confirm).toBeDisabled()

    fireEvent.click(checkboxes[0])
    expect(confirm).toBeDisabled()

    fireEvent.click(checkboxes[1])
    fireEvent.click(checkboxes[2])
    expect(confirm).toBeEnabled()
  })

  it("calls the action and refreshes on success", async () => {
    vi.mocked(requestDataExportAction).mockResolvedValue({
      success: true,
      value: undefined,
    })

    renderSection(null)
    completeTheGate()
    fireEvent.click(screen.getByRole("button", { name: /^confirm export$/i }))

    await waitFor(() => {
      expect(requestDataExportAction).toHaveBeenCalledWith({
        profileId: "profile-1",
      })
    })
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it("does not refresh when the action fails", async () => {
    vi.mocked(requestDataExportAction).mockResolvedValue({
      success: false,
      error: new Error("boom"),
      userMessage: "Something went wrong",
    })

    renderSection(null)
    completeTheGate()
    fireEvent.click(screen.getByRole("button", { name: /^confirm export$/i }))

    await waitFor(() => {
      expect(requestDataExportAction).toHaveBeenCalled()
    })
    expect(mockRefresh).not.toHaveBeenCalled()
  })
})
