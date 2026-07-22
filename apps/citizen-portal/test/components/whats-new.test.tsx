import { render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

type FeedState = {
  data: Array<{
    id: string
    title: string
    description: string
    publishDate: string
  }>
  error: unknown
  isLoading: boolean
}

let feedState: FeedState = { data: [], error: null, isLoading: false }

// Capture the args WhatsNew passes so we can assert it reuses the popup's
// feed but requests the full history (newOnly: false).
const feedCalls: unknown[][] = []

vi.mock("@ogcio/announcements/react", () => ({
  useAnnouncementFeed: (...args: unknown[]) => {
    feedCalls.push(args)
    return { ...feedState, refresh: vi.fn() }
  },
}))

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (namespace: string) => (key: string) => {
    const T: Record<string, string> = {
      "whatsNew.title": "What's new",
      "whatsNew.intro": "Recent updates and improvements to MessagingIE.",
      "whatsNew.empty": "There are no updates to show right now.",
      "whatsNew.error": "We couldn't load the latest updates.",
      "whatsNew.loading": "Loading updates",
    }
    return T[`${namespace}.${key}`] ?? `${namespace}.${key}`
  },
}))

vi.mock("@ogcio/design-system-react", () => ({
  Heading: ({
    children,
    "data-testid": testId,
  }: {
    children: React.ReactNode
    "data-testid"?: string
  }) => <h1 data-testid={testId}>{children}</h1>,
  Paragraph: ({
    children,
    "data-testid": testId,
  }: {
    children: React.ReactNode
    "data-testid"?: string
  }) => <p data-testid={testId}>{children}</p>,
  Spinner: () => <div data-testid='spinner' />,
  Stack: ({
    children,
    "data-testid": testId,
  }: {
    children: React.ReactNode
    "data-testid"?: string
  }) => <div data-testid={testId}>{children}</div>,
}))

// react-markdown (and its remark/rehype plugins) are ESM-only and not
// relevant to the branch logic under test — render the raw markdown text.
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => (
    <span data-testid='markdown'>{children}</span>
  ),
}))
vi.mock("remark-gfm", () => ({ default: () => undefined }))
vi.mock("rehype-raw", () => ({ default: () => undefined }))
vi.mock("rehype-sanitize", () => ({ default: () => undefined }))

vi.mock("@/components/layout/containers", () => ({
  TwoColumnLayout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

import { WhatsNew } from "@/components/whats-new/whats-new"

describe("WhatsNew", () => {
  beforeEach(() => {
    feedState = { data: [], error: null, isLoading: false }
    feedCalls.length = 0
  })

  it("requests the full announcement history for the messaging app", () => {
    render(<WhatsNew />)
    expect(feedCalls[0]).toEqual(["messaging", "en", { newOnly: false }])
  })

  it("shows a spinner while loading", () => {
    feedState = { data: [], error: null, isLoading: true }
    render(<WhatsNew />)
    expect(screen.getByTestId("spinner")).toBeInTheDocument()
    expect(screen.queryByTestId("whats-new-list")).not.toBeInTheDocument()
  })

  it("shows an error message when the feed fails", () => {
    feedState = { data: [], error: new Error("boom"), isLoading: false }
    render(<WhatsNew />)
    expect(screen.getByTestId("whats-new-error")).toHaveTextContent(
      "We couldn't load the latest updates.",
    )
  })

  it("shows an empty message when there are no announcements", () => {
    render(<WhatsNew />)
    expect(screen.getByTestId("whats-new-empty")).toHaveTextContent(
      "There are no updates to show right now.",
    )
  })

  it("renders announcements newest-first with their markdown body", () => {
    feedState = {
      error: null,
      isLoading: false,
      data: [
        {
          id: "older",
          title: "Data export",
          description: "Download your **data**.",
          publishDate: "2026-05-01T10:00:00Z",
        },
        {
          id: "newer",
          title: "Unified inbox",
          description: "All your messages in one place.",
          publishDate: "2026-06-01T10:00:00Z",
        },
      ],
    }
    render(<WhatsNew />)

    const items = screen.getAllByTestId("whats-new-item")
    expect(items).toHaveLength(2)
    // Newest publishDate first.
    expect(
      within(items[0]).getByRole("heading", { name: "Unified inbox" }),
    ).toBeInTheDocument()
    expect(
      within(items[1]).getByRole("heading", { name: "Data export" }),
    ).toBeInTheDocument()
    // Markdown body is passed through to the renderer.
    expect(within(items[0]).getByTestId("markdown")).toHaveTextContent(
      "All your messages in one place.",
    )
    expect(within(items[1]).getByTestId("markdown")).toHaveTextContent(
      "Download your **data**.",
    )
    // Formatted publish date rendered.
    expect(within(items[0]).getByText(/2026/)).toBeInTheDocument()
  })
})
