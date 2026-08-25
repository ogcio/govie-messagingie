export type MessageEventDetailItem = {
  messageId: string
  eventType: string
  eventStatus: string
  createdAt: string
  data: Record<string, unknown>
}

/**
 * Pulls the recipient/subject pair out of the first event in the timeline
 * that carries a `receiverFullName` (typically the originating
 * `message_create` event). Lives outside the client component so it can be
 * unit-tested without pulling in the React + design-system module graph.
 */
export function extractMessageMeta(
  events: MessageEventDetailItem[] | undefined,
) {
  for (const event of events ?? []) {
    if ("receiverFullName" in event.data) {
      return {
        recipient: String(event.data.receiverFullName ?? ""),
        subject: String(event.data.subject ?? ""),
      }
    }
  }
  return { recipient: "", subject: "" }
}

/**
 * The date the message was scheduled to be delivered, carried in the
 * `message_create` event's data. The events list view shows this date
 * (`message_event_summary.scheduled_at`), so the detail timeline must render
 * the same date on its `message_schedule` row — the event's own `createdAt`
 * is when scheduling was requested, which can be an earlier day.
 */
export function extractScheduledAt(
  events: MessageEventDetailItem[] | undefined,
): string | undefined {
  for (const event of events ?? []) {
    const scheduledAt = event.data.scheduledAt
    if (typeof scheduledAt === "string" && scheduledAt) {
      return scheduledAt
    }
  }
  return undefined
}
