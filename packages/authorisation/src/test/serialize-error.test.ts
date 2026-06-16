import { describe, expect, it } from "vitest"
import { serializeErrorForLog } from "../serialize-error"

describe("serializeErrorForLog", () => {
  it("serialises plain Error to name + message without stack", () => {
    const error = new Error("boom")
    const result = serializeErrorForLog(error)

    expect(result).toEqual({ name: "Error", message: "boom" })
    expect(result).not.toHaveProperty("stack")
  })

  it("preserves the constructor name for subclasses", () => {
    class CustomError extends Error {
      constructor(message: string) {
        super(message)
        this.name = "CustomError"
      }
    }

    const result = serializeErrorForLog(new CustomError("nope"))

    expect(result).toEqual({ name: "CustomError", message: "nope" })
  })

  it("includes string `code` (e.g. Node ECONNREFUSED) when present", () => {
    const error = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1"), {
      code: "ECONNREFUSED",
    })

    expect(serializeErrorForLog(error)).toEqual({
      name: "Error",
      message: "connect ECONNREFUSED 127.0.0.1",
      code: "ECONNREFUSED",
    })
  })

  it("ignores non-string `code` to avoid leaking arbitrary objects", () => {
    const error = Object.assign(new Error("x"), {
      code: { secret: "leak" },
    })

    expect(serializeErrorForLog(error)).toEqual({
      name: "Error",
      message: "x",
    })
  })

  it("includes `statusCode` from http-errors / fetch-style errors", () => {
    const error = Object.assign(new Error("Not Found"), { statusCode: 404 })

    expect(serializeErrorForLog(error)).toEqual({
      name: "Error",
      message: "Not Found",
      statusCode: 404,
    })
  })

  it("falls back to `status` when only that is present", () => {
    const error = Object.assign(new Error("Bad Request"), { status: 400 })

    expect(serializeErrorForLog(error)).toEqual({
      name: "Error",
      message: "Bad Request",
      statusCode: 400,
    })
  })

  it("ignores non-finite or non-numeric status values", () => {
    const a = Object.assign(new Error("x"), { statusCode: Number.NaN })
    const b = Object.assign(new Error("x"), { status: "401" })

    expect(serializeErrorForLog(a)).toEqual({ name: "Error", message: "x" })
    expect(serializeErrorForLog(b)).toEqual({ name: "Error", message: "x" })
  })

  it("includes `cause` as name + message only when it is itself an Error", () => {
    const cause = new TypeError("inner")
    const error = Object.assign(new Error("outer"), { cause })

    expect(serializeErrorForLog(error)).toEqual({
      name: "Error",
      message: "outer",
      cause: { name: "TypeError", message: "inner" },
    })
  })

  it("does not recurse into `cause.cause` (avoids unbounded chains)", () => {
    const root = new Error("root")
    const mid = Object.assign(new Error("mid"), { cause: root })
    const top = Object.assign(new Error("top"), { cause: mid })

    const result = serializeErrorForLog(top)

    expect(result.cause).toEqual({ name: "Error", message: "mid" })
    expect((result.cause as { cause?: unknown }).cause).toBeUndefined()
  })

  it("drops non-Error causes to avoid leaking arbitrary objects", () => {
    const error = Object.assign(new Error("outer"), {
      cause: { token: "secret" },
    })

    expect(serializeErrorForLog(error)).toEqual({
      name: "Error",
      message: "outer",
    })
  })

  it("does not leak unrelated own properties (e.g. axios response)", () => {
    const error = Object.assign(new Error("Request failed"), {
      response: { data: { token: "secret-jwt" }, headers: { auth: "x" } },
      config: { url: "https://api.example.com" },
    })

    const result = serializeErrorForLog(error)

    expect(result).toEqual({ name: "Error", message: "Request failed" })
    expect(JSON.stringify(result)).not.toContain("secret-jwt")
  })

  it("handles string errors", () => {
    expect(serializeErrorForLog("string-thrown")).toEqual({
      name: "UnknownError",
      message: "string-thrown",
    })
  })

  it("extracts `message` from plain object thrown values", () => {
    expect(
      serializeErrorForLog({ message: "plain object", token: "x" }),
    ).toEqual({
      name: "UnknownError",
      message: "plain object",
    })
  })

  it("falls back to String(value) for primitives and other types", () => {
    expect(serializeErrorForLog(42)).toEqual({
      name: "UnknownError",
      message: "42",
    })
    expect(serializeErrorForLog(null)).toEqual({
      name: "UnknownError",
      message: "null",
    })
    expect(serializeErrorForLog(undefined)).toEqual({
      name: "UnknownError",
      message: "undefined",
    })
  })
})
