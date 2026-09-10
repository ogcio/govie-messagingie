import { render } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

const useLocalePreferenceMock = vi.fn()

vi.mock("@/hooks/use-locale-preference", () => ({
  useLocalePreference: () => useLocalePreferenceMock(),
}))

import RootPage from "./page"

afterEach(() => {
  vi.unstubAllGlobals()
})

it("redirects to the preferred locale when ready", () => {
  const replace = vi.fn()
  vi.stubGlobal("location", { replace })
  useLocalePreferenceMock.mockReturnValue({ locale: "ga", isReady: true })

  render(<RootPage />)

  expect(replace).toHaveBeenCalledWith("/ga/send-a-message")
})
