import { describe, expect, it } from "vitest"
import { pickLocalized } from "./localized"

const text = { en: "English", ga: "Gaeilge" }

describe("pickLocalized", () => {
  it("selects Irish for the Irish locale", () => {
    expect(pickLocalized(text, "ga")).toBe("Gaeilge")
  })

  it("falls back to English when Irish is unavailable", () => {
    expect(pickLocalized({ en: "English" }, "ga")).toBe("English")
  })

  it("selects English for other locales", () => {
    expect(pickLocalized(text, "en")).toBe("English")
  })
})
