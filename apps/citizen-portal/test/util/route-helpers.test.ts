import { describe, expect, it, vi } from "vitest"

vi.mock("@/i18n/routing", () => ({
  routing: {
    locales: ["en", "ga"] as const,
    defaultLocale: "en" as const,
  },
}))

import { generateStaticParams } from "@/util/route-helpers"

/**
 * `generateStaticParams` feeds the Next.js static-export pipeline:
 * every `[locale]` segment in the unified app's app-router tree
 * needs one entry per supported locale, otherwise the page is left
 * out of the static export and nginx serves a 404. The helper is
 * tiny but its contract is high-stakes — pinning the exact return
 * shape ensures a future Next.js upgrade that changes the expected
 * `generateStaticParams` signature is caught here.
 */
describe("generateStaticParams", () => {
  it("emits one params entry per supported locale, keyed by 'locale'", () => {
    expect(generateStaticParams()).toEqual([{ locale: "en" }, { locale: "ga" }])
  })

  it("returns entries in the same order as routing.locales (deterministic build output)", () => {
    // The Next.js docs don't guarantee stable ordering, but a
    // deterministic order makes the build output diffable and keeps
    // the produced `.next/server/app/[locale]/*` directory tree
    // identical across machines. Worth pinning.
    const params = generateStaticParams()
    expect(params.map((p) => p.locale)).toEqual(["en", "ga"])
  })
})
