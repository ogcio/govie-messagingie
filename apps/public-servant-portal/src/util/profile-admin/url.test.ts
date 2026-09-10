import { describe, expect, it } from "vitest"
import { stringToAsterisk, trimSlash } from "./strings"
import { url } from "./url"

describe(url.name, () => {
  it("builds and encodes profile-admin routes", () => {
    const routes = url("ga")
    expect(routes.home).toBe("/ga")
    expect(routes.externalOgcio("https://example.test")).toBe(
      "https://example.test/ga",
    )
    expect(routes.serviceUsers.list).toBe("/ga/service-users")
    expect(routes.serviceUsers.one("a/b")).toBe(
      "/ga/service-users/detail?id=a%2Fb",
    )
    expect(routes.serviceUsers.edit("a b")).toBe(
      "/ga/service-users/edit?id=a%20b",
    )
    expect(routes.serviceUsers.imports("1")).toBe(
      "/ga/service-users/import?id=1",
    )
    expect(routes.policy.privacy("https://example.test")).toBe(
      "https://example.test/ga/privacy-policy",
    )
    expect(routes.policy.cookie("https://example.test")).toBe(
      "https://example.test/ga/cookie-policy",
    )
    expect(routes.policy.accessibilityStatement("https://example.test")).toBe(
      "https://example.test/ga/accessibility-statement",
    )
    expect(routes.policy.termsOfUse("https://example.test")).toBe(
      "https://example.test/ga/terms-of-use",
    )
  })

  it("uses the default locale when none is supplied", () => {
    expect(url("").home).toBe("/en")
  })
})

describe("profile-admin strings", () => {
  it("masks identifiers and trims trailing slashes", () => {
    expect(stringToAsterisk("ppsn")).toBe("*******")
    expect(stringToAsterisk("email")).toBe("****")
    expect(trimSlash("https://example.test///")).toBe("https://example.test")
    expect(trimSlash("")).toBe("")
  })
})
