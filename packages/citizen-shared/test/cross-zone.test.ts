import { describe, expect, it } from "vitest"
import {
  getCrossZoneHref,
  getSharedParentDomain,
  ZONES,
  type ZoneHosts,
} from "../src/cross-zone"

const localHosts: ZoneHosts = {
  messages: "http://messaging.local.test:8080",
  profile: "http://profile.local.test:8080",
  dashboard: "http://dashboard.local.test:8080",
}

const devHosts: ZoneHosts = {
  messages: "https://messaging.dev.services.gov.ie",
  profile: "https://profile.dev.services.gov.ie",
  dashboard: "https://dashboard.dev.services.gov.ie",
}

const uatHosts: ZoneHosts = {
  messages: "https://messaging.uat.services.gov.ie",
  profile: "https://profile.uat.services.gov.ie",
  dashboard: "https://dashboard.uat.services.gov.ie",
}

const prodHosts: ZoneHosts = {
  messages: "https://messaging.services.gov.ie",
  profile: "https://profile.services.gov.ie",
  dashboard: "https://dashboard.services.gov.ie",
}

describe("ZONES", () => {
  it("enumerates the three citizen-portal zones in the canonical order", () => {
    expect(ZONES).toEqual(["messages", "profile", "dashboard"])
  })
})

describe("getCrossZoneHref", () => {
  describe("dev environment", () => {
    it("builds a messages URL", () => {
      expect(getCrossZoneHref("messages", "/inbox", devHosts)).toBe(
        "https://messaging.dev.services.gov.ie/inbox",
      )
    })

    it("builds a profile URL", () => {
      expect(getCrossZoneHref("profile", "/personal-details", devHosts)).toBe(
        "https://profile.dev.services.gov.ie/personal-details",
      )
    })

    it("builds a dashboard URL", () => {
      expect(getCrossZoneHref("dashboard", "/home", devHosts)).toBe(
        "https://dashboard.dev.services.gov.ie/home",
      )
    })
  })

  describe("local environment", () => {
    it("builds a messages URL", () => {
      expect(getCrossZoneHref("messages", "/inbox", localHosts)).toBe(
        "http://messaging.local.test:8080/inbox",
      )
    })

    it("builds a profile URL", () => {
      expect(getCrossZoneHref("profile", "/personal-details", localHosts)).toBe(
        "http://profile.local.test:8080/personal-details",
      )
    })

    it("builds a dashboard URL", () => {
      expect(getCrossZoneHref("dashboard", "/home", localHosts)).toBe(
        "http://dashboard.local.test:8080/home",
      )
    })
  })

  describe("uat environment", () => {
    it("builds a messages URL", () => {
      expect(getCrossZoneHref("messages", "/inbox", uatHosts)).toBe(
        "https://messaging.uat.services.gov.ie/inbox",
      )
    })

    it("builds a profile URL", () => {
      expect(getCrossZoneHref("profile", "/personal-details", uatHosts)).toBe(
        "https://profile.uat.services.gov.ie/personal-details",
      )
    })

    it("builds a dashboard URL", () => {
      expect(getCrossZoneHref("dashboard", "/home", uatHosts)).toBe(
        "https://dashboard.uat.services.gov.ie/home",
      )
    })
  })

  describe("prod environment", () => {
    it("builds a messages URL", () => {
      expect(getCrossZoneHref("messages", "/inbox", prodHosts)).toBe(
        "https://messaging.services.gov.ie/inbox",
      )
    })

    it("builds a profile URL", () => {
      expect(getCrossZoneHref("profile", "/personal-details", prodHosts)).toBe(
        "https://profile.services.gov.ie/personal-details",
      )
    })

    it("builds a dashboard URL", () => {
      expect(getCrossZoneHref("dashboard", "/home", prodHosts)).toBe(
        "https://dashboard.services.gov.ie/home",
      )
    })
  })

  describe("path normalisation", () => {
    it("prepends a leading slash when the path is missing one", () => {
      expect(getCrossZoneHref("messages", "inbox", devHosts)).toBe(
        "https://messaging.dev.services.gov.ie/inbox",
      )
    })

    it("preserves a leading slash when already present", () => {
      expect(getCrossZoneHref("messages", "/inbox", devHosts)).toBe(
        "https://messaging.dev.services.gov.ie/inbox",
      )
    })

    it("preserves query strings and hashes verbatim", () => {
      expect(getCrossZoneHref("messages", "/inbox?id=42#top", devHosts)).toBe(
        "https://messaging.dev.services.gov.ie/inbox?id=42#top",
      )
    })

    it("strips a trailing slash from the host before joining", () => {
      const trailing: ZoneHosts = {
        messages: "https://messaging.dev.services.gov.ie/",
        profile: "https://profile.dev.services.gov.ie/",
        dashboard: "https://dashboard.dev.services.gov.ie/",
      }
      expect(getCrossZoneHref("messages", "/inbox", trailing)).toBe(
        "https://messaging.dev.services.gov.ie/inbox",
      )
    })

    it("collapses repeated trailing slashes on the host", () => {
      const trailing: ZoneHosts = {
        messages: "https://messaging.dev.services.gov.ie///",
        profile: "https://profile.dev.services.gov.ie",
        dashboard: "https://dashboard.dev.services.gov.ie",
      }
      expect(getCrossZoneHref("messages", "/inbox", trailing)).toBe(
        "https://messaging.dev.services.gov.ie/inbox",
      )
    })

    it("returns the host root when the path is just '/'", () => {
      expect(getCrossZoneHref("dashboard", "/", devHosts)).toBe(
        "https://dashboard.dev.services.gov.ie/",
      )
    })
  })
})

describe("getSharedParentDomain", () => {
  it("returns undefined for localhost", () => {
    expect(getSharedParentDomain("localhost")).toBeUndefined()
  })

  it("returns the .local.test parent for a local zone host", () => {
    expect(getSharedParentDomain("messaging.local.test")).toBe(".local.test")
    expect(getSharedParentDomain("profile.local.test")).toBe(".local.test")
    expect(getSharedParentDomain("dashboard.local.test")).toBe(".local.test")
  })

  it("returns the dev parent for a dev zone host", () => {
    expect(getSharedParentDomain("messaging.dev.services.gov.ie")).toBe(
      ".dev.services.gov.ie",
    )
  })

  it("returns the uat parent for a uat zone host", () => {
    expect(getSharedParentDomain("profile.uat.services.gov.ie")).toBe(
      ".uat.services.gov.ie",
    )
  })

  it("returns the prod parent for a prod zone host", () => {
    expect(getSharedParentDomain("dashboard.services.gov.ie")).toBe(
      ".services.gov.ie",
    )
  })

  it("returns undefined for an unrelated host so cookies don't leak", () => {
    expect(getSharedParentDomain("random.example.com")).toBeUndefined()
    expect(getSharedParentDomain("evil.gov.ie")).toBeUndefined()
  })
})
