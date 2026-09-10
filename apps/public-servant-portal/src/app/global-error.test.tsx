import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { expect, it, vi } from "vitest"

const { reloadOnceIfChunkLoadErrorMock } = vi.hoisted(() => ({
  reloadOnceIfChunkLoadErrorMock: vi.fn(() => false),
}))

vi.mock("next-intl", () => ({
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useTranslations: () => {
    const messages: Record<string, string> = {
      title: "Unexpected error",
      retry: "Try again",
    }
    return (key: string) => messages[key] ?? key
  },
}))

vi.mock("@/i18n/locale", () => ({
  detectLocale: () => "ga",
  messagesMap: { en: {}, ga: {} },
}))

vi.mock("@/util/chunk-error", () => ({
  reloadOnceIfChunkLoadError: reloadOnceIfChunkLoadErrorMock,
}))

import GlobalError from "./global-error"

it("renders the localized error and retries inside a replacement document", async () => {
  const reset = vi.fn()
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

  render(<GlobalError error={new Error("Broken request")} reset={reset} />)

  expect(consoleError).toHaveBeenCalled()
  await waitFor(() =>
    expect(
      screen.getByRole("heading", { name: "Unexpected error" }),
    ).toBeInTheDocument(),
  )
  expect(document.documentElement).toHaveAttribute("lang", "ga")
  expect(screen.getByRole("alert")).toHaveTextContent("Broken request")
  fireEvent.click(screen.getByRole("button", { name: "Try again" }))
  expect(reset).toHaveBeenCalledOnce()
  expect(reloadOnceIfChunkLoadErrorMock).toHaveBeenCalled()

  consoleError.mockRestore()
})
