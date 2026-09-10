import { render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const messages: Record<string, string> = {
      title: "Account inactive",
      description: "Contact an administrator.",
    }
    return (key: string) => messages[key] ?? key
  },
}))

import InactivePublicServantPage from "./page"

it("renders the inactive account guidance", () => {
  render(<InactivePublicServantPage />)

  expect(
    screen.getByRole("heading", { name: "Account inactive" }),
  ).toBeInTheDocument()
  expect(screen.getByText("Contact an administrator.")).toBeInTheDocument()
})
