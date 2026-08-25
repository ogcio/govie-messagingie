import { describe, expect, it } from "vitest";
import { isISODate } from "~/utils/dates.js";

describe("isISODate", () => {
  it("should return true for valid ISO dates", () => {
    const validDates = [
      "2024-01-15T12:30:45.123Z",
      "2024-01-15",
      "2024-01-15T12:30:45",
      "2024-01-15T12:30:45.123+01:00",
      "2024-01-15T12:30:45-05:00",
    ];

    for (const date of validDates) {
      expect(isISODate(date)).toBe(true);
    }
  });

  it("should return false for non-ISO dates", () => {
    const invalidDates = [
      "15/01/2024",
      "2024.01.15",
      "Jan 15 2024",
      "15-Jan-2024",
      "not a date",
      "",
      "2024",
      "123456789",
    ];

    for (const date of invalidDates) {
      expect(isISODate(date)).toBe(false);
    }
  });

  it("should return false for dates without hyphens", () => {
    const datesWithoutHyphens = [
      "20240115",
      "20240115T123045Z",
      "20240115T123045.123Z",
    ];

    for (const date of datesWithoutHyphens) {
      expect(isISODate(date)).toBe(false);
    }
  });

  it("should return false for invalid dates with hyphens", () => {
    const invalidDatesWithHyphens = [
      "2024-13-45", // invalid month
      "2024-00-15", // invalid month
      "2024-12-32", // invalid day
      "2024-12-00", // invalid day
      "-15-01-2024", // wrong format
    ];

    for (const date of invalidDatesWithHyphens) {
      expect(isISODate(date)).toBe(false);
    }
  });
});
