import { describe, expect, it } from "vitest";
import { toIsoDate } from "~/utils/dates.js";

describe("toIsoDate", () => {
  it.each([
    ["2026-03-03", "2026-03-03"],
    ["2026-03-03T10:15:30.000Z", "2026-03-03"],
    ["2026-03-03T23:30:00-02:00", "2026-03-04"],
    ["31/12/2026", "2026-12-31"],
    ["12/31/2026", "2026-12-31"],
    [" 31/12/2026 ", "2026-12-31"],
    ["03/04/2026", "2026-04-03"],
    ["29/02/2024", "2024-02-29"],
  ])("parses %s as %s", (input, expected) => {
    expect(toIsoDate(input)).toBe(expected);
  });

  it.each([
    "31/02/2026",
    "13/13/2026",
    "00/12/2026",
    "12/00/2026",
    "29/02/2023",
  ])("throws for invalid slash dates: %s", (input) => {
    expect(() => toIsoDate(input)).toThrow(RangeError);
  });

  it("throws for invalid date strings", () => {
    expect(() => toIsoDate("not-a-date")).toThrow(RangeError);
  });
});
