import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUTCDate } from "~/utils/dates.js";

describe("getCurrentUTCDate", () => {
  beforeEach(() => {
    // Use fake timers to control Date
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Restore real timers
    vi.useRealTimers();
  });

  it("should return current UTC date in ISO format", () => {
    // Set a fixed date for testing
    const fixedDate = new Date("2024-01-15T12:30:45.123Z");
    vi.setSystemTime(fixedDate);

    const result = getCurrentUTCDate();

    // Should return ISO string
    expect(result).toBe("2024-01-15T12:30:45.123Z");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("should handle date conversion correctly", () => {
    // Test with a non-UTC date
    const localDate = new Date("2024-01-15T15:30:45+03:00");
    vi.setSystemTime(localDate);

    const result = getCurrentUTCDate();

    // Should convert to UTC (12:30:45 UTC)
    expect(result).toBe("2024-01-15T12:30:45.000Z");
  });

  it("should return different dates for different times", () => {
    const date1 = new Date("2024-01-15T00:00:00Z");
    vi.setSystemTime(date1);
    const result1 = getCurrentUTCDate();

    const date2 = new Date("2024-01-16T00:00:00Z");
    vi.setSystemTime(date2);
    const result2 = getCurrentUTCDate();

    expect(result1).not.toBe(result2);
  });
});
