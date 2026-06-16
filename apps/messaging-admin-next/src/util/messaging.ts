export const EVENT_STATUSES = [
  "delivered",
  "failed",
  "opened",
  "scheduled",
] as const

export type EventStatus = (typeof EVENT_STATUSES)[number]

export function getInterpolationValues(text: string): string[] {
  return text.match(/[^{{]+(?=}})/g) || []
}

export function isStatus(status: unknown): status is EventStatus {
  return EVENT_STATUSES.some((c) => c === status)
}
