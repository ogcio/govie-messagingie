/** biome-ignore-all lint/suspicious/noExplicitAny: Convenience for testing */
import { describe, expect, it } from "vitest"
import type { NextSearchParams } from "../types"
import { buildListUserSdkBody } from "./logic"

describe("Profile Logic - buildListUserSdkBody", () => {
  it("should handle an empty filter array gracefully", () => {
    const result = buildListUserSdkBody({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.value).toStrictEqual({})
    }
  })

  it("should handle multi-word names with extra whitespace (Extreme Case)", () => {
    const params: NextSearchParams = {
      name: "  John Middle Doe  ",
    }
    const result = buildListUserSdkBody(params)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.value.name).toStrictEqual(["John Middle Doe"])
    }
  })

  it("should ignore unknown filters", () => {
    const params: NextSearchParams = {
      some_date: "2024",
    }
    const result = buildListUserSdkBody(params)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.value).toStrictEqual({})
    }
  })

  it("should handle names with special characters (O'Reilly, Müller)", () => {
    const params: NextSearchParams = {
      name: "O'Reilly",
    }
    const result = buildListUserSdkBody(params)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.value.name).toStrictEqual(["O'Reilly"]);
    }
  })

  it("should handle mixed known and unknown filter names", () => {
    const params: NextSearchParams = {
      name: "Valid Name",
      unknown_filter: "Should be ignored",
    }
    const result = buildListUserSdkBody(params)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.value.name).toStrictEqual(["Valid Name"])
      expect((result.value as any).unknown_filter).toBeUndefined()
    }
  })

  it("should skip filters that only contain whitespace", () => {
    const params: NextSearchParams = {
      name: "   ",
    }
    const result = buildListUserSdkBody(params)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.value.name).toBeUndefined()
    }
  })


  it("should handle array values for a single search key (e.g. multi-select)", async () => {
    const params = { email: ["test1@test.com", "test2@test.com"] }
    const result = buildListUserSdkBody(params)

    expect(result.success).toBe(true)
    if (result.success) {
      
      expect(result.value.email).toContain("test1@test.com")
      expect(result.value.email).toContain("test2@test.com")
    }
  })

  it("should correctly handle extremely long search strings (DoS check)", async () => {
    const longString = "a".repeat(1000)
    const params = { name: longString }
    const result = buildListUserSdkBody(params)

    expect(result.success).toBe(true)
    if(result.success) {
    expect(result.value.name).toStrictEqual([longString])
    }
  })

  it("builds a simple 'from' filter on a column", () => {
    const params = {dateOfBirth: "from,1941-06-13"}

    const result = buildListUserSdkBody(params)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.value.dateOfBirth).toStrictEqual([{ from: "1941-06-13", to: undefined }])
    }
  })

  it("builds a 'between' filter for key/value dates", () => {
    const params = {dateOfBirth: "between,1941-06-13,1941-12-31"}

    const result = buildListUserSdkBody(params)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.value.dateOfBirth).toStrictEqual([
        { from: "1941-06-13", to: "1941-12-31" },
      ])
    }
  })
});
