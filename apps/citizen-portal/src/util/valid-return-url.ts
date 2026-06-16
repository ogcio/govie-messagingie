/**
 * Validates an externally-supplied `returnUrl` / `postRedirectUri` /
 * `?redirect=` query parameter. Returns the original string only when it
 * parses as an http(s) URL — otherwise null.
 *
 * Used by the public error pages (wrong-account-error,
 * wrong-login-method-error) and the global-signout flow to make sure
 * the gateway never bounces the browser to a non-http origin (or worse,
 * a javascript: URL) crafted by an attacker.
 */
export function getValidReturnUrl(
  raw: string | null | undefined,
): string | null {
  if (raw == null || !raw.trim()) {
    return null
  }
  try {
    const url = new URL(raw)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null
    }
    return raw
  } catch {
    return null
  }
}
