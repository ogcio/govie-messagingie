import { type RenderOptions, render } from "@testing-library/react"
import type { ReactElement } from "react"

/**
 * Custom render function that wraps components with necessary providers
 * Use this instead of the default render from @testing-library/react
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  // Type assertion needed due to React 19 type compatibility with @testing-library/react
  return render(ui as Parameters<typeof render>[0], {
    ...options,
  })
}

/**
 * Mock data for testing
 */
export const mockMessage = {
  id: "1",
  subject: "Test message",
  createdAt: "2021-01-01",
  threadName: "Test thread",
  organisationId: "123",
  recipientUserId: "456",
  excerpt: "Test excerpt",
  plainText: "Test plain text",
  richText: "Test rich text",
  isSeen: false,
  securityLevel: "confidential" as const,
  attachments: ["123", "124"],
}

export const mockMessages = [
  mockMessage,
  {
    ...mockMessage,
    id: "2",
    subject: "Test message 2",
    createdAt: "2021-01-02",
    isSeen: true,
    securityLevel: "public" as const,
  },
]
