import { describe, expect, it } from "vitest"
import {
  DEFAULT_ZONE,
  getZoneFromHostname,
  organizationIdsForRole,
  ZONE_DEFAULT_PATH,
  ZONE_SAG_APP_NAME,
} from "@/util/zone"

/**
 * `getZoneFromHostname` is the single hostname-to-zone dispatch table for the
 * unified public-servant portal. The portal is served from two hostnames
 * (messaging-admin.* and profile-admin.*) behind one nginx pod; a regression
 * here silently routes users to the wrong shell, wrong role guard, and wrong
 * default landing page.
 */
describe("getZoneFromHostname", () => {
  it("returns the default zone for undefined", () => {
    expect(getZoneFromHostname(undefined)).toBe(DEFAULT_ZONE)
  })

  it("returns the default zone for an empty string", () => {
    expect(getZoneFromHostname("")).toBe(DEFAULT_ZONE)
  })

  it("returns the default zone for localhost (local dev without a hostname prefix)", () => {
    expect(getZoneFromHostname("localhost")).toBe("messaging-admin")
  })

  it("returns the default zone for an unrecognised hostname", () => {
    expect(getZoneFromHostname("unknown.services.gov.ie")).toBe(
      "messaging-admin",
    )
  })

  it.each([
    "messaging-admin.localhost",
    "messaging-admin.dev.services.gov.ie",
    "messaging-admin.uat.services.gov.ie",
    "messaging-admin.services.gov.ie",
  ])("returns 'messaging-admin' for %s", (hostname) => {
    expect(getZoneFromHostname(hostname)).toBe("messaging-admin")
  })

  it.each([
    "profile-admin.localhost",
    "profile-admin.dev.services.gov.ie",
    "profile-admin.uat.services.gov.ie",
    "profile-admin.services.gov.ie",
  ])("returns 'profile-admin' for %s", (hostname) => {
    expect(getZoneFromHostname(hostname)).toBe("profile-admin")
  })

  it("does NOT match a hostname that merely contains 'profile-admin' in the middle", () => {
    expect(getZoneFromHostname("my-profile-admin.example.com")).toBe(
      "messaging-admin",
    )
  })
})

describe("ZONE_SAG_APP_NAME", () => {
  it("covers exactly the two defined zones", () => {
    expect(Object.keys(ZONE_SAG_APP_NAME).sort()).toEqual([
      "messaging-admin",
      "profile-admin",
    ])
  })

  it("maps messaging-admin zone to the messaging-admin SAG app name", () => {
    expect(ZONE_SAG_APP_NAME["messaging-admin"]).toBe("messaging-admin")
  })

  it("maps profile-admin zone to the profile-admin SAG app name", () => {
    expect(ZONE_SAG_APP_NAME["profile-admin"]).toBe("profile-admin")
  })
})

describe("ZONE_DEFAULT_PATH", () => {
  it("covers exactly the two defined zones", () => {
    expect(Object.keys(ZONE_DEFAULT_PATH).sort()).toEqual([
      "messaging-admin",
      "profile-admin",
    ])
  })

  it("maps messaging-admin zone to the send-a-message landing", () => {
    expect(ZONE_DEFAULT_PATH["messaging-admin"]).toBe("send-a-message")
  })

  it("maps profile-admin zone to the service-users landing", () => {
    expect(ZONE_DEFAULT_PATH["profile-admin"]).toBe("service-users")
  })
})

describe("organizationIdsForRole", () => {
  it("keeps only orgs that carry the requested role", () => {
    expect(
      organizationIdsForRole(
        {
          organizations: ["org-profile", "org-messaging"],
          organization_roles: [
            "org-profile:Profile Public Servant",
            "org-messaging:Messaging Public Servant",
          ],
        },
        "Messaging Public Servant",
      ),
    ).toEqual(["org-messaging"])
  })

  it("returns no orgs when the role claim is present but none match", () => {
    expect(
      organizationIdsForRole(
        {
          organizations: ["org-profile"],
          organization_roles: ["org-profile:Profile Public Servant"],
        },
        "Messaging Public Servant",
      ),
    ).toEqual([])
  })

  it("falls back to organizations when the role claim is absent", () => {
    expect(
      organizationIdsForRole(
        { organizations: ["org-1", "org-2"] },
        "Messaging Public Servant",
      ),
    ).toEqual(["org-1", "org-2"])
  })
})
