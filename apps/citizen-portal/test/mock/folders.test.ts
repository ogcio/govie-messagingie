import { describe, expect, it } from "vitest"
import { getMoveDestinations } from "@/mock/folders"

describe("getMoveDestinations", () => {
  it("returns all mock folders when message is in inbox", () => {
    const destinations = getMoveDestinations(null, "Inbox")
    expect(destinations.map((d) => d.label)).toEqual(["EHIC", "Payslips"])
    expect(destinations.some((d) => d.id === null)).toBe(false)
  })

  it("excludes current folder and includes Inbox when message is in a folder", () => {
    const destinations = getMoveDestinations("mock-folder-ehic", "Inbox")
    expect(destinations).toEqual([
      { id: null, label: "Inbox" },
      { id: "mock-folder-payslips", label: "Payslips" },
    ])
  })
})
