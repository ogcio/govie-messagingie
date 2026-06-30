import { Temporal } from "@js-temporal/polyfill"

const DUBLIN_TIMEZONE = "Europe/Dublin"
const LOCALE = "en-IE"

type DateStyle = "short" | "medium" | "long"

const LOCALE_OPTIONS: Record<
  DateStyle,
  Intl.DateTimeFormatOptions
> = {
  short: { day: "2-digit", month: "2-digit", year: "numeric" },
  medium: { day: "numeric", month: "short", year: "numeric" },
  long: { day: "numeric", month: "long", year: "numeric" },
}

function parseInstant(iso: string): Temporal.Instant | null {
  try {
    return Temporal.Instant.from(iso)
  } catch {
    return null
  }
}

export function formatDate(iso: string, style: DateStyle = "short"): string {
  const instant = parseInstant(iso)
  if (!instant) return iso

  const zoned = instant.toZonedDateTimeISO(DUBLIN_TIMEZONE)
  return zoned.toLocaleString(LOCALE, LOCALE_OPTIONS[style])
}
