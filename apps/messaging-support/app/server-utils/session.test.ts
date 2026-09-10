// @vitest-environment node
// jose rejects Uint8Arrays created in jsdom's realm, so this pure-server
// module is tested in the node environment.
import { SignJWT } from "jose"
import { beforeEach, describe, expect, it, vi } from "vitest"

const cookieGet = vi.fn()
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet }),
}))

vi.mock("@/utils/env", () => ({
  getEnvConfig: () => ({ COOKIE_SECRET: "test-secret" }),
}))

const { requireSession } = await import("./session")

async function signSession(secret: string) {
  return new SignJWT({ sub: "agent-1" })
    .setProtectedHeader({ alg: "HS256" })
    .sign(new TextEncoder().encode(secret))
}

beforeEach(() => {
  cookieGet.mockReset()
})

describe("requireSession", () => {
  it("returns null without a session cookie", async () => {
    cookieGet.mockReturnValue(undefined)

    expect(await requireSession()).toBeNull()
  })

  it("returns the payload for a validly signed session", async () => {
    cookieGet.mockReturnValue({ value: await signSession("test-secret") })

    const payload = await requireSession()

    expect(payload?.sub).toBe("agent-1")
  })

  it("returns null for a session signed with the wrong secret", async () => {
    cookieGet.mockReturnValue({ value: await signSession("wrong-secret") })

    expect(await requireSession()).toBeNull()
  })

  it("returns null for a malformed token", async () => {
    cookieGet.mockReturnValue({ value: "not-a-jwt" })

    expect(await requireSession()).toBeNull()
  })
})
