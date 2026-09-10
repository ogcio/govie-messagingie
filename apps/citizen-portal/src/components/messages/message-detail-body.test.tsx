import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
  hasMessageBody,
  MessageDetailBody,
} from "@/components/messages/message-detail-body"

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      attachmentOnlyFallback:
        "Please select the attachment(s) to preview your message content",
    }
    return map[key] ?? key
  },
}))

vi.mock("@/components/messages/secure-email-viewer", () => ({
  SecureEmailViewer: ({ content }: { content: string }) => (
    <div data-testid='secure-email-viewer'>{content}</div>
  ),
}))

describe("hasMessageBody", () => {
  it("returns false when both rich and plain text are empty", () => {
    expect(hasMessageBody("", "")).toBe(false)
    expect(hasMessageBody(undefined, undefined)).toBe(false)
    expect(hasMessageBody("  ", "  ")).toBe(false)
  })

  it("returns true when plain text has content", () => {
    expect(hasMessageBody(undefined, "Hello")).toBe(true)
  })

  it("returns true when rich text has content", () => {
    expect(hasMessageBody("<p>Hi</p>", undefined)).toBe(true)
  })
})

describe("MessageDetailBody", () => {
  it("shows attachment-only fallback when there is no body but attachments exist", () => {
    render(
      <MessageDetailBody
        richText={undefined}
        plainText=''
        attachmentCount={1}
      />,
    )
    expect(
      screen.getByText(
        "Please select the attachment(s) to preview your message content",
      ),
    ).toBeInTheDocument()
  })

  it("renders plain text when present", () => {
    render(<MessageDetailBody plainText='Hello citizen' attachmentCount={0} />)
    expect(screen.getByText("Hello citizen")).toBeInTheDocument()
  })

  it("renders rich text via SecureEmailViewer when present", () => {
    render(<MessageDetailBody richText='<p>Rich</p>' attachmentCount={0} />)
    expect(screen.getByTestId("secure-email-viewer")).toHaveTextContent(
      "<p>Rich</p>",
    )
  })
})
