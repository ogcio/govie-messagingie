import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SubmissionDetailToolbar } from "@/components/submissions/submission-detail-toolbar"

vi.mock("@ogcio/design-system-react", () => ({
  Icon: () => null,
  Link: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode
    href?: string
  } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const byNamespace: Record<string, Record<string, string>> = {
      "home.button": { back: "Back" },
      "submissions.detail": {
        toolbarAriaLabel: "Application actions",
      },
    }
    return byNamespace[namespace]?.[key] ?? key
  },
}))

describe("SubmissionDetailToolbar", () => {
  it("links Back to the applications list", () => {
    render(<SubmissionDetailToolbar backHref='/en/my-submissions' />)

    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      "/en/my-submissions",
    )
  })
})
