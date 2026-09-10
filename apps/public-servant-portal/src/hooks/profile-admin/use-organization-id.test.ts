import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useOrganizationId } from "./use-organization-id"

const { useAuth, useOrganizationContext } = vi.hoisted(() => ({
  useAuth: vi.fn(() => ({
    claims: undefined as { organizations?: string[] } | undefined,
  })),
  useOrganizationContext: vi.fn(() => ({
    currentOrganization: { id: "profile-org" } as { id: string } | undefined,
  })),
}))

vi.mock("@ogcio/sag-client/react", () => ({ useAuth }))
vi.mock("./use-organization-context", () => ({ useOrganizationContext }))

describe(useOrganizationId.name, () => {
  it("returns the selected profile organization", () => {
    expect(renderHook(() => useOrganizationId()).result.current).toBe(
      "profile-org",
    )
  })

  it("falls back to the first organization claim", () => {
    useOrganizationContext.mockReturnValueOnce({
      currentOrganization: undefined,
    })
    useAuth.mockReturnValueOnce({ claims: { organizations: ["claim-org"] } })

    expect(renderHook(() => useOrganizationId()).result.current).toBe(
      "claim-org",
    )
  })
})
