import { describe, expect, it } from "vitest"
import { formatDate } from "@/util/datetime"

/**
 * `formatDate` is consumed by every list view (inbox, recent
 * messages on the dashboard, secure-message metadata). The locale
 * + timezone pair is fixed (`en-IE` / `Europe/Dublin`) because the
 * citizen-portal serves Irish residents and DS contract requires a
 * single canonical date format across the bundle. Parsing uses the Temporal
 * API (`@js-temporal/polyfill`) with explicit Dublin zone conversion.
 *
 * The DST boundary is the most likely silent regression: an
 * accidental swap to `toLocaleDateString()` without an explicit
 * `timeZone` would shift dates by a day for UTC-late-night
 * timestamps depending on the test runner's machine.
 */
describe("formatDate", () => {
  it("formats a UTC timestamp in en-IE short format (dd/mm/yyyy)", () => {
    // 2025-01-15 10:30 UTC → Europe/Dublin is UTC+0 in January, so
    // 15 January 2025.
    expect(formatDate("2025-01-15T10:30:00Z")).toBe("15/01/2025")
  })

  it("formats a UTC timestamp in en-IE medium format (d MMM yyyy)", () => {
    expect(formatDate("2025-01-15T10:30:00Z", "medium")).toBe("15 Jan 2025")
  })

  it("formats a UTC timestamp in en-IE long format (d MMMM yyyy)", () => {
    expect(formatDate("2026-04-17T10:00:00Z", "long")).toBe("17 April 2026")
  })

  it("honours Europe/Dublin's DST offset (BST = UTC+1)", () => {
    // 2025-07-15 22:30 UTC → 23:30 in Dublin (still the same day).
    expect(formatDate("2025-07-15T22:30:00Z")).toBe("15/07/2025")
  })

  it("rolls the date forward when the UTC timestamp falls past midnight Dublin time", () => {
    // 2025-07-15 23:30 UTC → 00:30 16 July in Dublin (BST).
    expect(formatDate("2025-07-15T23:30:00Z")).toBe("16/07/2025")
  })

  it("returns the input verbatim when the ISO string is unparseable", () => {
    // Some upstream APIs surface placeholder strings on missing data;
    // formatDate must never throw or produce "Invalid Date" — it's
    // rendered into a `<time>` element in the table without an
    // error boundary.
    expect(formatDate("not-a-date")).toBe("not-a-date")
    expect(formatDate("")).toBe("")
  })
})
