import { render, screen } from "@testing-library/react"
import { type ReadonlyURLSearchParams, useSearchParams } from "next/navigation"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { authErrors } from "@/utils/auth"
import Page from "./page"

vi.mock("@/utils/env", () => ({
  getEnvConfig: () => ({
    something: "mocked",
  }),
}))

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(),
}))

const createMockSearchParams = (
  usp: URLSearchParams = new URLSearchParams(),
) => {
  return {
    get: usp.get.bind(usp),
    entries: usp.entries.bind(usp),
    keys: usp.keys.bind(usp),
    values: usp.values.bind(usp),
    toString: usp.toString.bind(usp),
    has: usp.has.bind(usp),
    [Symbol.iterator]: usp[Symbol.iterator].bind(usp),
  } as unknown as ReadonlyURLSearchParams
}

describe("Auth Error Page", () => {
  let searchParams: ReturnType<typeof createMockSearchParams>
  beforeEach(() => {
    searchParams = createMockSearchParams()
    vi.mocked(useSearchParams).mockReturnValue(searchParams)
  })

  it("does happy init render", () => {
    render(<Page />)
    expect(
      screen.getByRole("heading", { level: 1, name: "Authentication error" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText("An unknown error occurred. Please try again."),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Try logging in again" }),
    ).toHaveAttribute("href", "/api/auth/signin")
  })

  it("shows specific error message when reason param is valid", () => {
    searchParams = createMockSearchParams(
      new URLSearchParams("reason=missing_nonce_cookie"),
    )
    vi.mocked(useSearchParams).mockReturnValue(searchParams)
    render(<Page />)

    expect(
      screen.getByText(authErrors.missing_nonce_cookie),
    ).toBeInTheDocument()
  })

  it("shows unknown error when reason param is invalid", () => {
    searchParams = createMockSearchParams(new URLSearchParams("reason=nogood"))

    render(<Page />)

    expect(screen.getByText(authErrors.unknown)).toBeInTheDocument()
  })
})
