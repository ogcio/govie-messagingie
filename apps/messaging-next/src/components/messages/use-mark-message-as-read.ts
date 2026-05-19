"use client"

import { useGatewayMutation } from "@ogcio/sag-client/react"
import { useEffect, useRef } from "react"
import { mutate as swrMutate } from "swr"

/**
 * Mark a message as read exactly once after its detail data has loaded,
 * then invalidate every cached `/messaging/api/v1/messages?...` listing so
 * the inbox row's `isSeen` flips on navigate-back instead of waiting on
 * SWR's focus / reconnect heuristics.
 *
 * Shared by `MessagesPage` (legacy) and `UnifiedInboxPage` (unified inbox)
 * so the two detail views can't drift on the mark-as-read contract — see
 * AB#37866 for the regression that motivated extracting this. The detail
 * endpoint key (`/messages/<id>`, no `?`) is intentionally left alone:
 * its host page is unmounting next anyway and revalidating it would just
 * spend a token on a request the user will never see.
 *
 * `useGatewayFetch` keys the SWR cache by the absolute gateway URL — or by
 * `[url, actorType]` when an actor type is set — so the matcher accepts
 * both shapes.
 *
 * @param id    The message id; drives both the URL path and the body's
 *              `messageId` (the API rejects mismatched values).
 * @param ready `true` once the caller has fetched the detail for `id` and
 *              wants the seen marker to fire. Typically `Boolean(data)`.
 */
export function useMarkMessageAsRead(id: string, ready: boolean): void {
  const hasMarkedRead = useRef(false)
  const { trigger: markAsSeen } = useGatewayMutation(
    `/messaging/api/v1/message-actions/${id}`,
    { method: "PUT" },
  )

  useEffect(() => {
    if (!ready || hasMarkedRead.current) return
    hasMarkedRead.current = true
    markAsSeen({ messageId: id, isSeen: true })
      .then(() => {
        void swrMutate((key: unknown) => {
          const url =
            typeof key === "string"
              ? key
              : Array.isArray(key) && typeof key[0] === "string"
                ? key[0]
                : ""
          return url.includes("/messaging/api/v1/messages?")
        })
      })
      .catch(() => {})
  }, [ready, id, markAsSeen])
}
