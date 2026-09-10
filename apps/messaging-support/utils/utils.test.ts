import { describe, expect, it } from "vitest"
import type { ProfileData } from "@/data/types"
import { authErrors, isAuthError } from "./auth"
import { getFullName, toURLSearchParams } from "./utils"

describe("toURLSearchParams", () => {
  it("appends scalar and array values", () => {
    const params = toURLSearchParams({
      a: "1",
      b: ["2", "3"],
    })

    expect(params.get("a")).toBe("1")
    expect(params.getAll("b")).toEqual(["2", "3"])
  })

  it("returns empty params for an empty object", () => {
    expect(toURLSearchParams({}).toString()).toBe("")
  })
})

describe("getFullName", () => {
  it("joins first and last name", () => {
    expect(
      getFullName({ firstName: "Ada", lastName: "Lovelace" } as ProfileData),
    ).toBe("Ada Lovelace")
  })

  it("skips missing parts", () => {
    expect(getFullName({ firstName: "Ada" } as ProfileData)).toBe("Ada")
  })

  it("returns Unknown Name for a missing profile", () => {
    expect(getFullName(null as unknown as ProfileData)).toBe("Unknown Name")
  })
})

describe("isAuthError", () => {
  it("accepts every known auth error key", () => {
    for (const key of Object.keys(authErrors)) {
      expect(isAuthError(key)).toBe(true)
    }
  })

  it("rejects unknown keys", () => {
    expect(isAuthError("nope")).toBe(false)
  })
})
