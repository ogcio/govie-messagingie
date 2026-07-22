import { describe, expect, it } from "vitest"
import { scrubPageUrlForObservability } from "@/util/scrub-page-url"

const MESSAGE_ID = "becb3e86-6a5c-48e1-8bf7-c1cb884df69c"

describe("scrubPageUrlForObservability", () => {
  it("scrubs ?id=<uuid> query parameters", () => {
    expect(
      scrubPageUrlForObservability(
        `https://messaging.dev.services.gov.ie/en/messages?id=${MESSAGE_ID}`,
      ),
    ).toBe("https://messaging.dev.services.gov.ie/en/messages?id=:id")
  })

  it("scrubs legacy /secure-messages/<uuid> path segments", () => {
    expect(
      scrubPageUrlForObservability(
        `https://messaging.dev.services.gov.ie/en/secure-messages/${MESSAGE_ID}`,
      ),
    ).toBe("https://messaging.dev.services.gov.ie/en/secure-messages/:id")
  })

  it("leaves URLs without message identifiers unchanged", () => {
    const url = "https://messaging.dev.services.gov.ie/en/messages"
    expect(scrubPageUrlForObservability(url)).toBe(url)
  })
})
