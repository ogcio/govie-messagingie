import { describe, expect, it } from "vitest"
import { getValidReturnUrl } from "@/util/valid-return-url"

/**
 * `getValidReturnUrl` is the open-redirect chokepoint for every
 * external `returnUrl` / `postRedirectUri` / `?redirect=` parameter
 * the public error pages and the global-signout flow consume.
 *
 * The guarantees we care about:
 *   1. Only http: and https: pass — never javascript:, data:, about:,
 *      vbscript:, file:, or any custom scheme.
 *   2. Null / undefined / empty / whitespace-only inputs return null.
 *   3. Anything that doesn't parse as a URL returns null.
 *   4. Valid URLs come back EXACTLY as supplied (we don't re-serialise
 *      because some downstream consumers compare strings).
 */
describe("getValidReturnUrl", () => {
  describe("nullish + empty", () => {
    it.each([
      null,
      undefined,
      "",
      "   ",
      "\t\n",
    ])("returns null for %p", (raw) => {
      expect(getValidReturnUrl(raw)).toBeNull()
    })
  })

  describe("malformed inputs", () => {
    it.each([
      "not a url",
      "//missing-scheme.example.com",
      "example.com/path",
    ])("returns null for %s", (raw) => {
      expect(getValidReturnUrl(raw)).toBeNull()
    })
  })

  describe("dangerous schemes", () => {
    it.each([
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "about:blank",
      "ftp://example.com/secret",
    ])("rejects %s — open-redirect protection", (raw) => {
      // Every entry in this list is a known XSS / SSRF vector. If
      // any of them returns a non-null value, the redirect target
      // gets handed to `window.location.assign()` (or equivalent)
      // unfiltered.
      expect(getValidReturnUrl(raw)).toBeNull()
    })
  })

  describe("valid URLs", () => {
    it.each([
      "http://messaging.local.test:8080",
      "https://messaging.dev.services.gov.ie",
      "https://messaging.dev.services.gov.ie/en/messages?id=abc",
      "https://messaging.dev.services.gov.ie/en/messages#fragment",
      "HTTP://EXAMPLE.COM",
    ])("returns %s verbatim", (raw) => {
      // Verbatim, not re-serialised: `new URL().toString()` would
      // strip default ports and lowercase the host, breaking
      // string-equality comparisons downstream.
      expect(getValidReturnUrl(raw)).toBe(raw)
    })
  })
})
