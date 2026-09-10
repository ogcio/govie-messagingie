import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useClientLanguages } from "./get-languages"

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_BASE_URL ??= "http://localhost:3022"
  process.env.NEXT_PUBLIC_SAG_URL ??= "http://localhost:3030"
})

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

describe(useClientLanguages.name, () => {
  it("switches English paths to Irish while retaining search", () => {
    const { result } = renderHook(() =>
      useClientLanguages({
        path: "/en/message-events",
        locale: "en",
        search: "delivery",
      }),
    )

    expect(result.current).toEqual({
      href: "http://localhost:3022/ga/message-events?search=delivery",
      label: "link.irish",
    })
  })

  it("switches Irish paths to English", () => {
    const { result } = renderHook(() =>
      useClientLanguages({
        path: "/ga/help",
        locale: "ga",
        search: null,
      }),
    )

    expect(result.current.href).toBe("http://localhost:3022/en/help?search=")
    expect(result.current.label).toBe("link.english")
  })

  it("handles a missing path", () => {
    const { result } = renderHook(() =>
      useClientLanguages({ path: null, locale: "en", search: null }),
    )

    expect(new URL(result.current.href).pathname).toBe("/")
  })
})
