import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useOrganizationId } from "./use-organization-id"

const { useAuth, useOrganizationContext } = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useOrganizationContext: vi.fn(),
}))

vi.mock("@ogcio/sag-client/react", () => ({ useAuth }))
vi.mock("./use-organization-context", () => ({ useOrganizationContext }))

describe(useOrganizationId.name, () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ claims: { organizations: ["claim-org"] } })
    useOrganizationContext.mockReturnValue({ currentOrganization: undefined })
  })

  it("prefers the selected organization", () => {
    useOrganizationContext.mockReturnValue({
      currentOrganization: { id: "selected-org" },
    })
    expect(renderHook(() => useOrganizationId()).result.current).toBe(
      "selected-org",
    )
  })

  it("falls back to the first organization claim", () => {
    expect(renderHook(() => useOrganizationId()).result.current).toBe(
      "claim-org",
    )
  })
})
