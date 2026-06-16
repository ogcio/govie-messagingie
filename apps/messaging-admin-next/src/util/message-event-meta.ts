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
