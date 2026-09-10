/**
 * Detection and recovery for webpack chunk-load failures.
 *
 * After a deploy, the new container image only contains the new build's
 * `/_next/static/chunks/*.[hash].js`. Any tab that was already open before the
 * rollout still holds the old HTML in memory, which references old chunk
 * filenames that are now 404 on the server. When the SPA triggers a dynamic
 * import, webpack's runtime throws a `ChunkLoadError` that bubbles to the
 * nearest Next.js error boundary.
 *
 * The fix is a single hard reload: `no-cache` HTML means the browser will
 * revalidate and pick up the new page, whose script tags reference the new
 * hashed chunks. We guard with `sessionStorage` so we only auto-reload once
 * per tab — if the error reproduces after reload it is not a stale-asset
 * issue and we should surface the real error page.
 */

const RELOAD_FLAG_KEY = "messaging-next:chunk-reload-attempted"

/**
 * Heuristically detects errors emitted by webpack / the browser when a lazy
 * chunk or dynamically imported module fails to load. Matches both the
 * `ChunkLoadError` class name used by webpack's runtime and the free-form
 * messages produced by native `import()` failures.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const err = error as { name?: unknown; message?: unknown }
  if (err.name === "ChunkLoadError") return true
  if (typeof err.message !== "string") return false
  return (
    /Loading (?:CSS )?chunk [\w-]+ failed/i.test(err.message) ||
    /Failed to fetch dynamically imported module/i.test(err.message) ||
    /error loading dynamically imported module/i.test(err.message)
  )
}

function hasSessionStorage(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      typeof window.sessionStorage !== "undefined"
    )
  } catch {
    return false
  }
}

function safeGetFlag(): string | null {
  if (!hasSessionStorage()) return null
  try {
    return window.sessionStorage.getItem(RELOAD_FLAG_KEY)
  } catch {
    return null
  }
}

function safeSetFlag(): void {
  if (!hasSessionStorage()) return
  try {
    window.sessionStorage.setItem(RELOAD_FLAG_KEY, "1")
  } catch {
    // Safari private mode and similar can throw — swallow; worst case we
    // attempt the reload again on the next error, which is still preferable
    // to surfacing a ChunkLoadError to the user.
  }
}

/**
 * If `error` is a chunk-load failure and we have not already attempted a
 * recovery reload in this tab, trigger `window.location.reload()`.
 *
 * Returns `true` when a reload is scheduled (caller should avoid rendering
 * the error UI — the page is about to unload). Returns `false` otherwise.
 */
export function reloadOnceIfChunkLoadError(error: unknown): boolean {
  if (!isChunkLoadError(error)) return false
  if (typeof window === "undefined") return false
  if (safeGetFlag() === "1") return false

  safeSetFlag()
  window.location.reload()
  return true
}
