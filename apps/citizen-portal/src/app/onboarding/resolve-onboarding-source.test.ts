import { describe, expect, it } from "vitest"
import { resolveOnboardingSource } from "./resolve-onboarding-source"

describe("resolveOnboardingSource", () => {
  it("returns null when source is missing", () => {
    expect(resolveOnboardingSource(null)).toBeNull()
  })

  it("accepts journey preLogin URLs that mention onboarding only in query params", () => {
    const source =
      "https://journey.dev.services.gov.ie/en/preLogin?loginUrl=%2Fen%2Flogin&postLoginRedirectUrl=https%3A%2F%2Fjourney.dev.services.gov.ie%2Fen%2Fjourney%2Fabc&authMethods=social%3Amygovid&origin=validate-account-onboarding"

    expect(resolveOnboardingSource(source)).toBe(source)
  })

  it("rejects sources whose pathname is the onboarding page", () => {
    expect(
      resolveOnboardingSource(
        "https://profile.dev.services.gov.ie/onboarding?source=https%3A%2F%2Fapp.example",
      ),
    ).toBeNull()
  })
})
