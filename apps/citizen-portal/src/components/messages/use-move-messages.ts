"use client"

import { useGatewayMutation } from "@ogcio/sag-client/react"
import { useCallback, useState } from "react"

export interface MoveMessagesResult {
  ok: boolean
  ids: string[]
  folderId: string | null
}

export interface UseMoveMessagesOptions {
  onSettled?: () => void
}

/**
 * Wraps `POST /messaging/api/v1/messages/tags`, which assigns (or, with
 * `tagId: null`, removes) a folder tag on a set of messages. `folderId`
 * mirrors the move modal's destination value: a tag id moves into a folder,
 * `null` moves back to the inbox.
 */
export function useMoveMessages(options: UseMoveMessagesOptions = {}) {
  const { onSettled } = options
  const { trigger, isLoading } = useGatewayMutation<
    { tagId: string | null; messageIds: string[] },
    { tagId: string | null; messageIds: string[] }
  >("/messaging/api/v1/messages/tags", { method: "POST" })
  const [lastResult, setLastResult] = useState<MoveMessagesResult | null>(null)

  const moveIds = useCallback(
    async (
      ids: string[],
      folderId: string | null,
    ): Promise<MoveMessagesResult> => {
      const unique = Array.from(new Set(ids))
      try {
        await trigger({ tagId: folderId, messageIds: unique })
        const result: MoveMessagesResult = { ok: true, ids: unique, folderId }
        setLastResult(result)
        return result
      } catch {
        const result: MoveMessagesResult = {
          ok: false,
          ids: unique,
          folderId,
        }
        setLastResult(result)
        return result
      } finally {
        onSettled?.()
      }
    },
    [trigger, onSettled],
  )

  const dismissResult = useCallback(() => setLastResult(null), [])

  return { moveIds, isLoading, lastResult, dismissResult }
}
