import { describe, expect, it, vi } from "vitest"

vi.mock("@/utils/env", () => ({
  getEnvConfig: () => ({ BASE_URL: "https://support.test" }),
}))

const { GET } = await import("./route")

describe("GET /api/auth/signout", () => {
  it("redirects to the base url and clears the session cookie", async () => {
    const res = await GET()

    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("https://support.test/")
    const setCookie = res.headers.get("set-cookie") ?? ""
    expect(setCookie).toContain("session=")
    expect(setCookie.toLowerCase()).toContain("expires=thu, 01 jan 1970")
  })
})
