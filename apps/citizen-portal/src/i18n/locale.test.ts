import { describe, expect, it } from "vitest"
import { detectLocale, messagesMap } from "./locale"

describe("locale helpers", () => {
  it.each([
    ["/en/messages", "en"],
    ["/ga/profile", "ga"],
    ["/unknown", "en"],
  ])("detects the locale from %s", (pathname, expected) => {
    window.history.replaceState(null, "", pathname)
    expect(detectLocale()).toBe(expected)
  })

  it("provides messages for every locale", () => {
    expect(messagesMap.en).toBeDefined()
    expect(messagesMap.ga).toBeDefined()
  })
})
