import dayjs from "dayjs"
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import {
  buildSchedule,
  daysAgo,
  daysFromNow,
  formatDate,
  formatTime,
  oneYearAgo,
  today,
  toIrishTime,
} from "@/util/datetime"

/**
 * All helpers normalise to Europe/Dublin. We freeze the clock to a UTC instant
 * that crosses midnight in Dublin (during IST it is UTC+1, so 2026-06-15T23:30:00Z
 * is 00:30 the next day in Dublin) to catch timezone bugs that would silently
 * shift "today" by a calendar day depending on whether the conversion happened.
 */
const FIXED_NOW = "2026-06-15T23:30:00.000Z"

beforeAll(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(FIXED_NOW))
})

afterAll(() => {
  vi.useRealTimers()
})

afterEach(() => {
  vi.setSystemTime(new Date(FIXED_NOW))
})

describe("toIrishTime", () => {
  it("converts an ISO timestamp to the Europe/Dublin offset", () => {
    const ist = toIrishTime("2026-06-15T12:00:00.000Z")
    expect(ist.utcOffset()).toBe(60)
    expect(ist.format("YYYY-MM-DD HH:mm")).toBe("2026-06-15 13:00")
  })

  it("respects the standard-time (winter) offset", () => {
    const gmt = toIrishTime("2026-01-15T12:00:00.000Z")
    expect(gmt.utcOffset()).toBe(0)
    expect(gmt.format("YYYY-MM-DD HH:mm")).toBe("2026-01-15 12:00")
  })
})

describe("formatDate", () => {
  it("uses DD-MM-YYYY by default", () => {
    expect(formatDate("2026-06-15T12:00:00.000Z")).toBe("15-06-2026")
  })

  it("accepts a custom format string", () => {
    expect(formatDate("2026-06-15T12:00:00.000Z", "YYYY/MM/DD")).toBe(
      "2026/06/15",
    )
  })
})

describe("formatTime", () => {
  it("renders time in Dublin local time", () => {
    expect(formatTime("2026-06-15T12:00:00.000Z")).toBe("13:00:00")
  })
})

describe("today / daysAgo / daysFromNow / oneYearAgo", () => {
  /**
   * Frozen now = 2026-06-15T23:30:00Z = 2026-06-16T00:30 in Dublin.
   * Naive UTC handling would return "2026-06-15"; the Dublin-aware
   * implementation must return "2026-06-16".
   */
  it("returns today in Dublin local time (catches off-by-one TZ bugs)", () => {
    expect(today()).toBe("2026-06-16")
  })

  it("subtracts whole days from now", () => {
    expect(daysAgo(1)).toBe("2026-06-15")
    expect(daysAgo(7)).toBe("2026-06-09")
  })

  it("adds whole days to now", () => {
    expect(daysFromNow(1)).toBe("2026-06-17")
    expect(daysFromNow(30)).toBe("2026-07-16")
  })

  it("returns the date one year ago", () => {
    expect(oneYearAgo()).toBe("2025-06-16")
  })
})

describe("buildSchedule", () => {
  /**
   * Known caveat: `buildSchedule(date, time)` parses the input as machine-local
   * time (dayjs's default) and then formats with the Dublin offset. The returned
   * instant therefore depends on the machine TZ, which is a latent bug worth
   * tracking. The assertions below pin behaviour in a TZ-independent way: the
   * returned ISO must represent the same wall-clock as the input when read back
   * in the machine's local zone.
   */
  it("returns an ISO string whose wall-clock matches the input in machine-local TZ", () => {
    const iso = buildSchedule("2026-06-15", "09:30")
    expect(dayjs(iso).isValid()).toBe(true)
    const back = new Date(iso)
    expect(back.getFullYear()).toBe(2026)
    expect(back.getMonth()).toBe(5) // June, 0-indexed
    expect(back.getDate()).toBe(15)
    expect(back.getHours()).toBe(9)
    expect(back.getMinutes()).toBe(30)
  })

  it("returns the current Dublin time when fewer than two args are given", () => {
    const iso = buildSchedule()
    const parsed = dayjs(iso).tz("Europe/Dublin")
    expect(parsed.format("YYYY-MM-DD HH:mm")).toBe("2026-06-16 00:30")
  })
})
