const UUID =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"

/** `?id=<uuid>` or `&id=<uuid>` on message routes. */
const MESSAGE_ID_QUERY = new RegExp(`([?&]id=)${UUID}`, "gi")

/** Legacy `/secure-messages/<uuid>` path segments from email links. */
const MESSAGE_ID_PATH = new RegExp(`(/secure-messages/)${UUID}`, "gi")

/**
 * Scrub message identifiers from page URLs before they are sent as Faro page
 * metadata and Session Replay Meta events (via `pageUrlProcessor` / `withReplay`).
 */
export function scrubPageUrlForObservability(url: string): string {
  return url
    .replace(MESSAGE_ID_QUERY, "$1:id")
    .replace(MESSAGE_ID_PATH, "$1:id")
}
