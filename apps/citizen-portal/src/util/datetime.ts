const DUBLIN_TIMEZONE = "Europe/Dublin"

export function formatDate(iso: string, style: "short" | "medium" = "short") {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso

  if (style === "medium") {
    return date.toLocaleDateString("en-IE", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: DUBLIN_TIMEZONE,
    })
  }

  return date.toLocaleDateString("en-IE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: DUBLIN_TIMEZONE,
  })
}
