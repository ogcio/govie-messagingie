import { fireEvent, render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"

const { pushLog } = vi.hoisted(() => ({ pushLog: vi.fn() }))

vi.mock("@grafana/faro-web-sdk", () => ({
  faro: { api: { pushLog } },
}))

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const messages: Record<string, string> = {
      title: "Something went wrong",
      paragraph: "Please try again.",
      button: "Retry",
    }
    return (key: string) => messages[key] ?? key
  },
}))

vi.mock("@/util/chunk-error", () => ({
  isChunkLoadError: () => false,
  reloadOnceIfChunkLoadError: () => false,
}))

import ErrorPage from "./error"

it("reports the error, renders its message, and retries", () => {
  const reset = vi.fn()

  render(<ErrorPage error={new Error("Request failed")} reset={reset} />)

  expect(screen.getByRole("alert")).toHaveTextContent("Request failed")
  expect(pushLog).toHaveBeenCalledWith(["Error: Request failed"])
  fireEvent.click(screen.getByRole("button", { name: "Retry" }))
  expect(reset).toHaveBeenCalledOnce()
})
