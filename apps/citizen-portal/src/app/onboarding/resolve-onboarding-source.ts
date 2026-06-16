/** Reject sources that point back to this onboarding page (redirect loops). */
export function resolveOnboardingSource(
  rawSource: string | null,
): string | null {
  if (!rawSource) return null
  try {
    const { pathname } = new URL(rawSource)
    if (pathname === "/onboarding" || pathname.endsWith("/onboarding")) {
      return null
    }
    return rawSource
  } catch {
    return /\/onboarding(?:\?|$|\/)/i.test(rawSource) ? null : rawSource
  }
}
