"use client"

import { useGatewayMutation } from "@ogcio/sag-client/react"
import { useCallback, useState } from "react"

export interface DeleteMessagesResult {
  /** Whether the most recent delete succeeded. */
  ok: boolean
  /** Ids the user attempted to delete (same input, for the success copy). */
  ids: string[]
}

export interface UseDeleteMessagesOptions {
  /** Called after a delete attempt (success or failure) so the caller can refresh lists. */
  onSettled?: () => void
}

/**
 * Wraps the gateway `DELETE /messaging/api/v1/messages` endpoint (see
 * messaging-api deleteMessages service). Soft-delete is backend-side; the hook
 * exposes the last result so the list view can render the info/danger alert
 * banners from the design.
 */
export function useDeleteMessages(options: UseDeleteMessagesOptions = {}) {
  const { onSettled } = options

  const { trigger, isLoading } = useGatewayMutation<
    { data: { ids: string[] } },
    { ids: string[] }
  >("/messaging/api/v1/messages", { method: "DELETE" })

  const [lastResult, setLastResult] = useState<DeleteMessagesResult | null>(
    null,
  )

  const deleteIds = useCallback(
    async (ids: string[]): Promise<DeleteMessagesResult> => {
      const unique = Array.from(new Set(ids))
      try {
        await trigger({ ids: unique })
        const result: DeleteMessagesResult = { ok: true, ids: unique }
        setLastResult(result)
        return result
      } catch {
        const result: DeleteMessagesResult = { ok: false, ids: unique }
        setLastResult(result)
        return result
      } finally {
        onSettled?.()
      }
    },
    [trigger, onSettled],
  )

  const dismissResult = useCallback(() => setLastResult(null), [])

  return { deleteIds, isLoading, lastResult, dismissResult }
}
