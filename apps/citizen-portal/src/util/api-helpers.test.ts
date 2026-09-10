import { describe, expect, it } from "vitest"
import { getBaseUrl, isConnectionError } from "./api-helpers"

describe("isConnectionError", () => {
  it.each([
    new Error("connect ECONNREFUSED 127.0.0.1"),
    new Error("fetch failed"),
    Object.assign(new Error("request failed"), {
      cause: new Error("ECONNREFUSED"),
    }),
  ])("recognises connection failures", (error) => {
    expect(isConnectionError(error)).toBe(true)
  })

  it.each([null, "ECONNREFUSED", new Error("bad response")])(
    "rejects unrelated values",
    (error) => {
      expect(isConnectionError(error)).toBe(false)
    },
  )
})

describe("getBaseUrl", () => {
  it("returns the configured public base URL", () => {
    expect(getBaseUrl()).toBeTypeOf("string")
  })
})
