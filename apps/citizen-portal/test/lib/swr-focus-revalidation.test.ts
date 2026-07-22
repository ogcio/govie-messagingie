import { describe, expect, it } from "vitest"
import { shouldRevalidateOnFocus } from "@/lib/swr-focus-revalidation"

describe("shouldRevalidateOnFocus", () => {
  it("revalidates the messages list, detail, unread-count and metadata", () => {
    const gw = "https://gateway.example"
    expect(
      shouldRevalidateOnFocus(
        `${gw}/messaging/api/v1/messages?limit=20&offset=0`,
      ),
    ).toBe(true)
    expect(
      shouldRevalidateOnFocus(`${gw}/messaging/api/v1/messages/abc-123`),
    ).toBe(true)
    expect(
      shouldRevalidateOnFocus(
        `${gw}/messaging/api/v1/messages?limit=1&isSeen=false`,
      ),
    ).toBe(true)
  })

  it("revalidates related messages served by the public messaging API", () => {
    expect(
      shouldRevalidateOnFocus(
        "https://gateway.example/messaging-public-api/api/v1/citizens/messages?submissionId=s-1",
      ),
    ).toBe(true)
  })

  it("revalidates the applications (submissions) list and detail", () => {
    const gw = "https://gateway.example"
    expect(
      shouldRevalidateOnFocus(
        `${gw}/journey-builder/api/v1/external/user-submissions?limit=20`,
      ),
    ).toBe(true)
    expect(
      shouldRevalidateOnFocus(
        `${gw}/journey-builder/api/v1/external/user-submissions/sub-1`,
      ),
    ).toBe(true)
  })

  it("does not revalidate static resources on focus", () => {
    const gw = "https://gateway.example"
    expect(shouldRevalidateOnFocus(`${gw}/messaging/api/v1/tags`)).toBe(false)
    expect(
      shouldRevalidateOnFocus(`${gw}/profile/api/v1/organisations/org-1`),
    ).toBe(false)
    expect(shouldRevalidateOnFocus(`${gw}/upload/api/v1/metadata/file-1`)).toBe(
      false,
    )
  })

  it("does not revalidate consent statements or latest consent on focus", () => {
    const gw = "https://gateway.example"
    expect(
      shouldRevalidateOnFocus(
        `${gw}/profile/api/v1/citizens/consent-statements/current?subject=messaging`,
      ),
    ).toBe(false)
    expect(
      shouldRevalidateOnFocus(
        `${gw}/profile/api/v1/citizens/consents/latest?subject=messaging`,
      ),
    ).toBe(false)
  })

  it("reads the url from a [url, actorType] tuple key", () => {
    expect(
      shouldRevalidateOnFocus([
        "https://gateway.example/messaging/api/v1/messages",
        "m2m",
      ]),
    ).toBe(true)
    expect(
      shouldRevalidateOnFocus([
        "https://gateway.example/messaging/api/v1/tags",
        "m2m",
      ]),
    ).toBe(false)
  })

  it("returns false for empty or non-string keys", () => {
    expect(shouldRevalidateOnFocus(null)).toBe(false)
    expect(shouldRevalidateOnFocus(undefined)).toBe(false)
    expect(shouldRevalidateOnFocus(123)).toBe(false)
    expect(shouldRevalidateOnFocus([])).toBe(false)
  })
})
