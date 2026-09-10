import { describe, expect, it } from "vitest"
import {
  failure,
  fetchUsersConcurrent,
  isError,
  serializeErrorForLog,
  success,
} from "./utils"

describe("success / failure", () => {
  it("wraps a value in a Success", () => {
    expect(success(1)).toEqual({ success: true, value: 1 })
  })

  it("keeps a real Error in a Failure", () => {
    const err = new Error("boom")
    const result = failure(err, "user message")

    expect(result.success).toBe(false)
    expect(result.error).toBe(err)
    expect(result.userMessage).toBe("user message")
  })

  it("wraps a non-Error in a new Error carrying the user message", () => {
    const result = failure("string error", "user message")

    expect(result.error).toBeInstanceOf(Error)
    expect(result.error.message).toBe("user message")
  })
})

describe("isError", () => {
  it("accepts Error instances", () => {
    expect(isError(new Error("x"))).toBe(true)
  })

  it("rejects error-shaped plain objects", () => {
    expect(isError({ message: "x" })).toBe(false)
  })

  it("rejects primitives", () => {
    expect(isError("x")).toBe(false)
    expect(isError(null)).toBe(false)
  })
})

describe("serializeErrorForLog", () => {
  it("whitelists name/message/code/statusCode/cause and drops the stack", () => {
    const cause = new Error("inner")
    const err = Object.assign(new Error("outer"), {
      code: "E_TEST",
      statusCode: 502,
      cause,
      secret: "do-not-log",
    })

    const out = serializeErrorForLog(err)

    expect(out).toEqual({
      name: "Error",
      message: "outer",
      code: "E_TEST",
      statusCode: 502,
      cause: { name: "Error", message: "inner" },
    })
    expect(out).not.toHaveProperty("stack")
    expect(out).not.toHaveProperty("secret")
  })

  it("falls back to status when statusCode is missing", () => {
    const err = Object.assign(new Error("x"), { status: 404 })
    expect(serializeErrorForLog(err).statusCode).toBe(404)
  })

  it("handles string errors", () => {
    expect(serializeErrorForLog("plain")).toEqual({
      name: "UnknownError",
      message: "plain",
    })
  })
})

describe("fetchUsersConcurrent", () => {
  it("preserves input order in results", async () => {
    const ids = ["a", "b", "c"]
    const results = await fetchUsersConcurrent(
      ids,
      async (id) => `user-${id}`,
      2,
    )

    expect(results).toEqual(["user-a", "user-b", "user-c"])
  })

  it("leaves a hole and continues when one fetch throws", async () => {
    const results = await fetchUsersConcurrent(
      ["a", "bad", "c"],
      async (id) => {
        if (id === "bad") throw new Error("nope")
        return id
      },
    )

    expect(results[0]).toBe("a")
    expect(results[1]).toBeUndefined()
    expect(results[2]).toBe("c")
  })

  it("never runs more than the concurrency limit at once", async () => {
    let inFlight = 0
    let maxInFlight = 0

    await fetchUsersConcurrent(
      ["a", "b", "c", "d", "e"],
      async (id) => {
        inFlight++
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise((r) => setTimeout(r, 1))
        inFlight--
        return id
      },
      2,
    )

    expect(maxInFlight).toBeLessThanOrEqual(2)
  })
})
