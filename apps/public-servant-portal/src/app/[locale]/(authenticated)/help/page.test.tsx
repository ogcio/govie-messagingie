import { render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"

vi.mock("next-intl", () => ({
  useLocale: () => "ga",
  useTranslations: () =>
    Object.assign((key: string) => key, {
      rich: (
        key: string,
        values: Record<string, (chunks: React.ReactNode) => React.ReactNode>,
      ) => {
        const formatter = values.link ?? values.b
        return (
          <>
            {key} {formatter?.(formatter === values.link ? "link" : "bold")}
          </>
        )
      },
    }),
}))

vi.mock("@/env/env.client", () => ({
  env: {
    NEXT_PUBLIC_BASE_URL: "https://messaging.example",
    NEXT_PUBLIC_PROFILE_ADMIN_URL: "https://profile.example",
  },
}))

vi.mock("@/util/url", () => ({
  url: (locale: string) => ({
    messageTemplates: { list: `/${locale}/message-templates` },
    sendAMessage: `/${locale}/send-a-message`,
  }),
}))

import HelpPage from "./page"

it("renders the help content with locale-aware destinations", () => {
  render(<HelpPage />)

  expect(
    screen.getByRole("heading", { name: "heading.welcome" }),
  ).toBeInTheDocument()
  expect(screen.getByRole("list")).toBeInTheDocument()
  const inlineLinks = screen.getAllByRole("link", { name: "link" })
  expect(inlineLinks[0]).toHaveAttribute(
    "href",
    "https://messaging.example/ga/message-templates",
  )
  expect(inlineLinks[1]).toHaveAttribute(
    "href",
    "https://profile.example/ga/service-users",
  )
  expect(
    screen.getByRole("link", { name: "button.sendAMessage" }),
  ).toHaveAttribute("href", "/ga/send-a-message")
})
