import { describe, expect, it } from "vitest"
import { buildLocaleSwitchHref } from "@/util/locale-switch-href"

describe("buildLocaleSwitchHref", () => {
  it("swaps locale in the path", () => {
    expect(
      buildLocaleSwitchHref("/en/wrong-login-method-error", "en", "ga", null),
    ).toBe("/ga/wrong-login-method-error")
  })

  it("preserves query parameters when switching locale", () => {
    const searchParams = new URLSearchParams({
      returnUrl:
        "https://journey.dev.services.gov.ie/en/journey/3269e979-fca2-4000-ada1-2fa3034ec51e",
    })

    expect(
      buildLocaleSwitchHref(
        "/en/wrong-login-method-error",
        "en",
        "ga",
        searchParams,
      ),
    ).toBe(
      "/ga/wrong-login-method-error?returnUrl=https%3A%2F%2Fjourney.dev.services.gov.ie%2Fen%2Fjourney%2F3269e979-fca2-4000-ada1-2fa3034ec51e",
    )
  })
})
