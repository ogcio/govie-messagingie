import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MessageStatus } from "@/components/message-events/MessageStatus"

/**
 * Pin the type/status → translation-key mapping plus the fallback path
 * (regression for AB#37462 commit dcc6435 — without the fallback, an
 * unmapped (type, status) pair returned `undefined` and broke rendering).
 */
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => `event.status.${key}`,
}))

vi.mock("@ogcio/design-system-react", () => ({
  Tag: ({ type, text }: { type: string; text: string }) => (
    <span data-testid='tag' data-type={type}>
      {text}
    </span>
  ),
}))

type Case = {
  type: string
  status: string
  expectedTagType: string
  expectedText: string
}

const MAPPED_CASES: Case[] = [
  {
    type: "message_delivery",
    status: "successful",
    expectedTagType: "success",
    expectedText: "event.status.delivered",
  },
  {
    type: "message_delivery",
    status: "failed",
    expectedTagType: "error",
    expectedText: "event.status.deliveredFailed",
  },
  {
    type: "message_delivery",
    status: "pending",
    expectedTagType: "warning",
    expectedText: "event.status.delivering",
  },
  {
    type: "message_schedule",
    status: "successful",
    expectedTagType: "info",
    expectedText: "event.status.scheduled",
  },
  {
    type: "message_schedule",
    status: "failed",
    expectedTagType: "error",
    expectedText: "event.status.failed",
  },
  {
    type: "message_schedule",
    status: "pending",
    expectedTagType: "info",
    expectedText: "event.status.delivering",
  },
  {
    type: "message_create",
    status: "successful",
    expectedTagType: "default",
    expectedText: "event.status.created",
  },
  {
    type: "email_delivery",
    status: "successful",
    expectedTagType: "success",
    expectedText: "event.status.delivered",
  },
  {
    type: "email_delivery",
    status: "failed",
    expectedTagType: "error",
    expectedText: "event.status.deliveredFailed",
  },
  {
    type: "message_option_seen",
    status: "successful",
    expectedTagType: "success",
    expectedText: "event.status.seen",
  },
  {
    type: "message_option_unseen",
    status: "successful",
    expectedTagType: "success",
    expectedText: "event.status.unseen",
  },
]

describe("MessageStatus", () => {
  it.each(MAPPED_CASES)(
    "renders ($type, $status) as a $expectedTagType tag with text $expectedText",
    ({ type, status, expectedTagType, expectedText }) => {
      render(<MessageStatus type={type} status={status} />)
      const tag = screen.getByTestId("tag")
      expect(tag).toHaveAttribute("data-type", expectedTagType)
      expect(tag).toHaveTextContent(expectedText)
    },
  )

  /**
   * Fallback regression — AB#37462 commit dcc6435. Before this fix the
   * component returned `undefined` for unknown (type, status) pairs, which
   * crashed the table renderer. The fallback now always renders a default
   * Tag with the raw type (underscores → spaces) and status in parentheses.
   */
  describe("fallback for unmapped (type, status)", () => {
    it("renders an unknown type with the raw labels", () => {
      render(<MessageStatus type='novel_event_type' status='successful' />)
      const tag = screen.getByTestId("tag")
      expect(tag).toHaveAttribute("data-type", "default")
      expect(tag).toHaveTextContent("novel event type (successful)")
    })

    it("renders a known type with an unmapped status via fallback", () => {
      render(<MessageStatus type='message_delivery' status='partial' />)
      const tag = screen.getByTestId("tag")
      expect(tag).toHaveAttribute("data-type", "default")
      expect(tag).toHaveTextContent("message delivery (partial)")
    })

    it("renders message_create with an unmapped status via fallback", () => {
      render(<MessageStatus type='message_create' status='failed' />)
      const tag = screen.getByTestId("tag")
      expect(tag).toHaveAttribute("data-type", "default")
      expect(tag).toHaveTextContent("message create (failed)")
    })
  })
})
