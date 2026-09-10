import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  persistLastSelectedOrganization,
  readLastSelectedOrganization,
} from "@/util/last-selected-org"

/**
 * The last-selected-org store is the durable cross-logout memory of the admin
 * user's chosen organization (AB#28623): written on every explicit switch and
 * on each authenticated render, read at login to restore the selection before
 * the gateway cookie is re-established.
 */
describe("last-selected-org", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it("round-trips a saved organization for a user", () => {
    persistLastSelectedOrganization("user-1", "org-abc")
    expect(readLastSelectedOrganization("user-1")).toBe("org-abc")
  })

  it("returns null when nothing has been saved for the user", () => {
    expect(readLastSelectedOrganization("user-1")).toBeNull()
  })

  it("scopes the saved value per user so choices never leak across accounts", () => {
    persistLastSelectedOrganization("user-1", "org-abc")
    expect(readLastSelectedOrganization("user-2")).toBeNull()
  })

  it("overwrites the previous value on a subsequent switch", () => {
    persistLastSelectedOrganization("user-1", "org-abc")
    persistLastSelectedOrganization("user-1", "org-xyz")
    expect(readLastSelectedOrganization("user-1")).toBe("org-xyz")
  })

  it("is a no-op when the user sub is missing", () => {
    persistLastSelectedOrganization(undefined, "org-abc")
    expect(readLastSelectedOrganization(undefined)).toBeNull()
  })

  it("does not persist an empty organization id", () => {
    persistLastSelectedOrganization("user-1", undefined)
    expect(readLastSelectedOrganization("user-1")).toBeNull()
  })
})
