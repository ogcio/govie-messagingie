import { afterAll, beforeAll, describe, expect, it } from "vitest"

const ORIGINAL_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL

beforeAll(() => {
  process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3022"
  process.env.NEXT_PUBLIC_SAG_URL = "http://localhost:3030"
})

afterAll(() => {
  process.env.NEXT_PUBLIC_BASE_URL = ORIGINAL_BASE_URL
})

const importModule = async () =>
  await import("@/util/url-utils.client")

describe("buildClientUrl", () => {
  it("joins locale and path against the configured base URL", async () => {
    const { buildClientUrl } = await importModule()
    const url = buildClientUrl({ locale: "en", url: "send-a-message" })
    expect(url.href).toBe("http://localhost:3022/en/send-a-message")
  })

  it("strips leading/trailing slashes in locale and path", async () => {
    const { buildClientUrl } = await importModule()
    const url = buildClientUrl({ locale: "/en/", url: "/send-a-message/" })
    expect(url.href).toBe("http://localhost:3022/en/send-a-message")
  })

  it("accepts a null locale", async () => {
    const { buildClientUrl } = await importModule()
    const url = buildClientUrl({ locale: null, url: "help" })
    expect(url.pathname).toBe("/help")
  })
})

describe("buildClientUrlWithSearchParams", () => {
  it("appends scalar search params", async () => {
    const { buildClientUrlWithSearchParams } = await importModule()
    const url = buildClientUrlWithSearchParams({
      dir: "message-events",
      locale: "en",
      searchParams: { search: "foo", status: "delivered" },
    })
    expect(url.searchParams.get("search")).toBe("foo")
    expect(url.searchParams.get("status")).toBe("delivered")
  })

  it("appends each value for array-valued params", async () => {
    const { buildClientUrlWithSearchParams } = await importModule()
    const url = buildClientUrlWithSearchParams({
      dir: "message-events",
      locale: "en",
      searchParams: { ids: ["a", "b", "c"] },
    })
    expect(url.searchParams.getAll("ids")).toEqual(["a", "b", "c"])
  })

  it("URL-encodes special characters in values", async () => {
    const { buildClientUrlWithSearchParams } = await importModule()
    const url = buildClientUrlWithSearchParams({
      dir: "message-events",
      locale: "en",
      searchParams: { search: "hello world & co" },
    })
    expect(url.search).toContain("hello+world+%26+co")
  })

  it("works with no search params", async () => {
    const { buildClientUrlWithSearchParams } = await importModule()
    const url = buildClientUrlWithSearchParams({
      dir: "help",
      locale: "en",
      searchParams: undefined,
    })
    expect(url.pathname).toBe("/en/help")
    expect(url.search).toBe("")
  })
})
