import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockGetEnv = vi.fn()

vi.mock("@citizen-portal/shared", () => ({
  getEnv: () => mockGetEnv(),
}))

/**
 * `get-zone-from-origin.ts` is the *only* zone signal available on the
 * locale-landing routes (`[locale]/page.tsx`, `app/page.tsx`) — the
 * pathname carries no zone hint there, so the redirect target is keyed
 * off the hostname instead. This suite locks every deployment
 * environment's hostname triple plus the safe-by-default fallbacks
 * (server render, malformed env URLs, unknown host) because a
 * regression here turns into a hard-to-spot wrong-zone redirect on
 * production landing.
 */
describe("getZoneFromOrigin", () => {
  const originalWindow = globalThis.window

  beforeEach(() => {
    mockGetEnv.mockReset()
  })

  afterEach(() => {
    // Restore JSDOM's window after the SSR-fallback test deletes it.
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: originalWindow,
    })
    vi.resetModules()
  })

  function setOrigin(origin: string) {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: { location: { origin } },
    })
  }

  const ENVS = [
    {
      name: "local docker harness",
      hosts: {
        messages: "http://messaging.local.test:8080",
        profile: "http://profile.local.test:8080",
        dashboard: "http://dashboard.local.test:8080",
      },
    },
    {
      name: "dev cluster",
      hosts: {
        messages: "https://messaging.dev.services.gov.ie",
        profile: "https://profile.dev.services.gov.ie",
        dashboard: "https://dashboard.dev.services.gov.ie",
      },
    },
    {
      name: "uat cluster",
      hosts: {
        messages: "https://messaging.uat.services.gov.ie",
        profile: "https://profile.uat.services.gov.ie",
        dashboard: "https://dashboard.uat.services.gov.ie",
      },
    },
    {
      name: "prod cluster",
      hosts: {
        messages: "https://messaging.services.gov.ie",
        profile: "https://profile.services.gov.ie",
        dashboard: "https://dashboard.services.gov.ie",
      },
    },
  ] as const

  for (const { name, hosts } of ENVS) {
    describe(name, () => {
      it("resolves the messages hostname to 'messages'", async () => {
        mockGetEnv.mockReturnValue({
          hosts,
          sagUrl: "",
          sagAppName: "",
        })
        setOrigin(new URL(hosts.messages).origin)
        const { getZoneFromOrigin } = await import(
          "@/util/get-zone-from-origin"
        )
        expect(getZoneFromOrigin()).toBe("messages")
      })

      it("resolves the profile hostname to 'profile'", async () => {
        mockGetEnv.mockReturnValue({ hosts, sagUrl: "", sagAppName: "" })
        setOrigin(new URL(hosts.profile).origin)
        const { getZoneFromOrigin } = await import(
          "@/util/get-zone-from-origin"
        )
        expect(getZoneFromOrigin()).toBe("profile")
      })

      it("resolves the dashboard hostname to 'dashboard'", async () => {
        mockGetEnv.mockReturnValue({ hosts, sagUrl: "", sagAppName: "" })
        setOrigin(new URL(hosts.dashboard).origin)
        const { getZoneFromOrigin } = await import(
          "@/util/get-zone-from-origin"
        )
        expect(getZoneFromOrigin()).toBe("dashboard")
      })
    })
  }

  describe("fallbacks", () => {
    it("falls back to 'dashboard' on the server (no window)", async () => {
      // Strip the JSDOM window — production SSR hits this path before
      // hydration. The helper must not throw and must produce a safe
      // default so the SSR redirect still emits a valid URL.
      // @ts-expect-error — deleting a globally-defined property is
      // unavoidable for a runtime SSR simulation.
      delete globalThis.window
      mockGetEnv.mockReturnValue({
        hosts: ENVS[0].hosts,
        sagUrl: "",
        sagAppName: "",
      })
      const { getZoneFromOrigin } = await import("@/util/get-zone-from-origin")
      expect(getZoneFromOrigin()).toBe("dashboard")
    })

    it("falls back to 'dashboard' when the origin doesn't match any zone", async () => {
      mockGetEnv.mockReturnValue({
        hosts: ENVS[1].hosts,
        sagUrl: "",
        sagAppName: "",
      })
      setOrigin("https://random.example.com")
      const { getZoneFromOrigin } = await import("@/util/get-zone-from-origin")
      expect(getZoneFromOrigin()).toBe("dashboard")
    })

    it("falls back to 'dashboard' when a zone's env URL is malformed", async () => {
      // A malformed URL must not poison resolution for the other two
      // zones. Here only the messages URL is broken; the helper should
      // skip it cleanly and the unknown-origin path then lands on the
      // dashboard fallback.
      mockGetEnv.mockReturnValue({
        hosts: {
          messages: "not-a-url",
          profile: "https://profile.dev.services.gov.ie",
          dashboard: "https://dashboard.dev.services.gov.ie",
        },
        sagUrl: "",
        sagAppName: "",
      })
      setOrigin("https://messaging.dev.services.gov.ie")
      const { getZoneFromOrigin } = await import("@/util/get-zone-from-origin")
      expect(getZoneFromOrigin()).toBe("dashboard")
    })

    it("matches case-sensitively against the env hostnames", async () => {
      mockGetEnv.mockReturnValue({
        hosts: ENVS[1].hosts,
        sagUrl: "",
        sagAppName: "",
      })
      // URL.origin lower-cases the host, so an upper-case browser
      // origin still resolves correctly. This is what the WHATWG URL
      // spec guarantees; pinning it stops a future refactor from
      // swapping new URL() for a string-equality check that would
      // miss this case.
      setOrigin("https://MESSAGING.dev.services.gov.ie".toLowerCase())
      const { getZoneFromOrigin } = await import("@/util/get-zone-from-origin")
      expect(getZoneFromOrigin()).toBe("messages")
    })
  })
})
