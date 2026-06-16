import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

let fetchState: { data: { publicName?: string } | undefined } = {
  data: undefined,
}
const fetchCalls: Array<string | null> = []

vi.mock("@ogcio/sag-client/react", () => ({
  useGatewayFetch: (path: string | null) => {
    fetchCalls.push(path)
    return fetchState
  },
}))

import type { AuthUser } from "@ogcio/sag-client"
import { usePublicName } from "@/hooks/use-public-name"

/**
 * `usePublicName` drives the welcome heading on the dashboard and the
 * authenticated `PageHeader`. The fallback chain is explicitly tiered:
 *
 *   profile.publicName -> user.name -> user.email -> ""
 *
 * so a user that JUST signed in (profile fetch in flight) sees their
 * IdP-provided name rather than blank space, but the canonical
 * citizen-chosen name always wins once it loads. Pinning each tier
 * stops a future refactor from accidentally rearranging the chain
 * (e.g. swapping `email` above `name` would be a privacy regression).
 */
describe("usePublicName", () => {
  beforeEach(() => {
    fetchState = { data: undefined }
    fetchCalls.length = 0
  })

  it("returns profile.publicName when the profile fetch resolves", () => {
    fetchState = { data: { publicName: "Janet Citizen" } }
    const user = {
      sub: "user-1",
      name: "Jane Citizen",
      email: "jane@example.com",
    } as unknown as AuthUser

    const { result } = renderHook(() => usePublicName(user))
    expect(result.current).toBe("Janet Citizen")
  })

  it("falls back to user.name when profile.publicName is missing", () => {
    fetchState = { data: undefined }
    const user = {
      sub: "user-1",
      name: "Jane Citizen",
      email: "jane@example.com",
    } as unknown as AuthUser

    const { result } = renderHook(() => usePublicName(user))
    expect(result.current).toBe("Jane Citizen")
  })

  it("falls back to user.email when both profile.publicName and user.name are missing", () => {
    fetchState = { data: undefined }
    const user = {
      sub: "user-1",
      email: "jane@example.com",
    } as unknown as AuthUser

    const { result } = renderHook(() => usePublicName(user))
    expect(result.current).toBe("jane@example.com")
  })

  it("returns the empty string when the user has no identifiers", () => {
    fetchState = { data: undefined }
    const user = { sub: "user-1" } as unknown as AuthUser

    const { result } = renderHook(() => usePublicName(user))
    expect(result.current).toBe("")
  })

  it("returns the empty string when the user is undefined (unauthenticated)", () => {
    // Pre-auth, the hook still runs from inside the rendered tree.
    // Make sure it stays safe-by-default — no throws, no nullable
    // surprises on the consumer side.
    const { result } = renderHook(() => usePublicName(undefined))
    expect(result.current).toBe("")
  })

  it("pauses the gateway fetch (passes null path) until user.sub is available", () => {
    // SWR/useGatewayFetch is keyed on the path; a null path tells the
    // gateway client to skip the request. The dashboard mounts this
    // hook before auth has resolved, so the pause is what stops a
    // pre-auth 401 from being logged to o11y.
    renderHook(() => usePublicName(undefined))
    expect(fetchCalls[0]).toBeNull()
  })

  it("calls the gateway with the profile path keyed on user.sub once auth resolves", () => {
    const user = { sub: "user-42" } as unknown as AuthUser
    renderHook(() => usePublicName(user))
    expect(fetchCalls[0]).toBe("/profile/api/v1/profiles/user-42")
  })
})
