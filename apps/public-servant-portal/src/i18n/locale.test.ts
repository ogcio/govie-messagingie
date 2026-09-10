import { afterEach, describe, expect, it, vi } from "vitest"
import { requiredInDevelopment, requiredInProduction } from "@/env/utils"
import { generateStaticParams } from "@/util/route-helpers"
import { detectLocale } from "./locale"

afterEach(() => vi.unstubAllEnvs())

describe(detectLocale.name, () => {
  it("reads supported locales from the pathname", () => {
    window.history.replaceState({}, "", "/ga/help")
    expect(detectLocale()).toBe("ga")
  })

  it("falls back for unsupported locales", () => {
    window.history.replaceState({}, "", "/fr/help")
    expect(detectLocale()).toBe("en")
  })
})

describe("environment refinements", () => {
  it("requires production values only in production", () => {
    const addIssue = vi.fn()
    vi.stubEnv("NODE_ENV", "production")
    requiredInProduction(undefined, { addIssue } as never)
    requiredInDevelopment(undefined, { addIssue } as never)
    requiredInProduction("set", { addIssue } as never)
    expect(addIssue).toHaveBeenCalledOnce()
  })

  it("requires development values only in development", () => {
    const addIssue = vi.fn()
    vi.stubEnv("NODE_ENV", "development")
    requiredInDevelopment(undefined, { addIssue } as never)
    requiredInProduction(undefined, { addIssue } as never)
    requiredInDevelopment("set", { addIssue } as never)
    expect(addIssue).toHaveBeenCalledOnce()
  })
})

it("generates one static parameter per supported locale", () => {
  expect(generateStaticParams()).toEqual([{ locale: "en" }, { locale: "ga" }])
})
