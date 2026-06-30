import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AttachmentCard } from "@/components/messages/attachment-card"

const mockOpenPreview = vi.fn().mockResolvedValue(undefined)
const mockSaveFile = vi.fn().mockResolvedValue(undefined)

const useGatewayDownloadCalls: Array<{ openInNewTab?: boolean }> = []

vi.mock("next-intl", () => ({
  useTranslations:
    () =>
    (key: string, params?: { fileName?: string }) => {
      if (key === "preview") return "Preview"
      if (key === "download") return "Download"
      if (key === "previewFile") return `Preview ${params?.fileName ?? ""}`
      if (key === "downloadFile") return `Download ${params?.fileName ?? ""}`
      return key
    },
}))

vi.mock("@ogcio/sag-client/react", () => ({
  useGatewayFetch: (path: string) => {
    const idMatch = path.match(/^\/upload\/api\/v1\/metadata\/(.+)$/)
    if (!idMatch) {
      return { data: undefined }
    }
    return {
      data: {
        fileName: "payslip.pdf",
        fileSize: 2048,
      },
    }
  },
  useGatewayDownload: (options?: { openInNewTab?: boolean }) => {
    useGatewayDownloadCalls.push(options ?? {})
    if (options?.openInNewTab) {
      return { download: mockOpenPreview, isDownloading: false }
    }
    return { download: mockSaveFile, isDownloading: false }
  },
}))

describe("AttachmentCard", () => {
  beforeEach(() => {
    mockOpenPreview.mockClear()
    mockSaveFile.mockClear()
    useGatewayDownloadCalls.length = 0
  })

  it("renders file name and size", () => {
    render(<AttachmentCard id='file-123' />)

    expect(screen.getByText("payslip.pdf")).toBeInTheDocument()
    expect(screen.getByText("2 kb")).toBeInTheDocument()
  })

  it("opens preview in a new tab when Preview is clicked", () => {
    render(<AttachmentCard id='file-123' />)

    fireEvent.click(
      screen.getByRole("button", { name: "Preview payslip.pdf" }),
    )

    expect(mockOpenPreview).toHaveBeenCalledWith(
      "/upload/api/v1/files/file-123",
      "payslip.pdf",
    )
    expect(mockSaveFile).not.toHaveBeenCalled()
  })

  it("downloads directly when Download button is clicked", () => {
    render(<AttachmentCard id='file-123' />)

    fireEvent.click(
      screen.getByRole("button", { name: "Download payslip.pdf" }),
    )

    expect(mockSaveFile).toHaveBeenCalledWith(
      "/upload/api/v1/files/file-123",
      "payslip.pdf",
    )
    expect(mockOpenPreview).not.toHaveBeenCalled()
  })

  it("configures separate download hooks for preview and direct download", () => {
    render(<AttachmentCard id='file-123' />)

    expect(useGatewayDownloadCalls).toEqual([
      { openInNewTab: true },
      { openInNewTab: false },
    ])
  })
})
