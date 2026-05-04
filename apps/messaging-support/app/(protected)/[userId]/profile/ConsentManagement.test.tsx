/** biome-ignore-all lint/suspicious/noExplicitAny: testing */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useRouter } from "next/navigation"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { GetUserConsentDataResponse } from "@/data/types"
import { updateProfileConsentDataAction } from "@/utils/actions"
import { ConsentManagement } from "./ConsentManagement"

vi.mock("@/utils/actions", () => ({
  updateProfileConsentDataAction: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}))

const profileId = "profile-id-123"

const mockConsent = {
  id: "consent-1",
  subject: "marketing",
  status: "opted-in" as const,
  version: "1.0",
  cascadeReason: "",
  createdAt: "2026-01-01T00:00:00Z",
}

const successConsentData: GetUserConsentDataResponse = {
  success: true,
  value: {
    consents: [mockConsent],
  } as any,
}

const failureConsentData: GetUserConsentDataResponse = {
  success: false,
  error: new Error(),
  userMessage: "Cannot retrieve consent data",
}

function selectOption(optionText: string) {
  fireEvent.click(screen.getByRole("textbox", { name: /select/i }))
  fireEvent.click(screen.getByRole("option", { name: optionText }))
}

describe("ConsentManagement Component", () => {
  const mockRefresh = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useRouter as any).mockReturnValue({
      refresh: mockRefresh,
    })
  })

  it("should render the warning alert when consent data fetch failed", () => {
    render(
      <ConsentManagement
        consentData={failureConsentData}
        profileId={profileId}
      />,
    )

    expect(
      screen.getByText(/Cannot retrieve latest consent data\./i),
    ).toBeInTheDocument()
  })

  it("should render a row per consent with the mapped status tag", () => {
    render(
      <ConsentManagement
        consentData={successConsentData}
        profileId={profileId}
      />,
    )

    expect(screen.getByText(mockConsent.subject)).toBeInTheDocument()
    expect(screen.getByText("Accepted")).toBeInTheDocument()
  })

  it("should render the modal title and select for each consent", () => {
    render(
      <ConsentManagement
        consentData={successConsentData}
        profileId={profileId}
      />,
    )

    expect(
      screen.getByText(`Update ${mockConsent.subject} consent`),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        `Select a new consent status for ${mockConsent.subject}`,
      ),
    ).toBeInTheDocument()
  })

  it("should call the server action and refresh the router on success", async () => {
    ;(updateProfileConsentDataAction as any).mockResolvedValue({
      success: true,
    })

    render(
      <ConsentManagement
        consentData={successConsentData}
        profileId={profileId}
      />,
    )

    selectOption("Declined")

    fireEvent.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(updateProfileConsentDataAction).toHaveBeenCalledWith({
        profileId,
        consents: [{ subject: mockConsent.subject, status: "opted-out" }],
      })
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it("should show the error alert when the server action fails", async () => {
    ;(updateProfileConsentDataAction as any).mockResolvedValue({
      success: false,
      error: new Error("update failed"),
    })

    render(
      <ConsentManagement
        consentData={successConsentData}
        profileId={profileId}
      />,
    )

    selectOption("Declined")

    fireEvent.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByText(/Failed to update consent/i)).toBeInTheDocument()
    })
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it("should disable the Save button and show a spinner while pending", async () => {
    ;(updateProfileConsentDataAction as any).mockReturnValue(
      new Promise((resolve) =>
        setTimeout(() => resolve({ success: true }), 100),
      ),
    )

    render(
      <ConsentManagement
        consentData={successConsentData}
        profileId={profileId}
      />,
    )

    selectOption("Declined")

    const saveBtn = screen.getByRole("button", { name: /save/i })
    fireEvent.click(saveBtn)

    expect(saveBtn).toBeDisabled()
    expect(screen.getAllByRole("status")).toHaveLength(1)
  })
})
