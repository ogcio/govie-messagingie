"use client"

import { useSagClient } from "@ogcio/sag-client/react"
import { useCallback, useState } from "react"

export interface DeleteFolderResult {
  ok: boolean
}

export interface UseDeleteFolderOptions {
  onSettled?: () => void
}

/**
 * Wraps `DELETE /messaging/api/v1/tags/:tagId`. The backend reassigns any
 * messages in the folder back to the inbox (`tag_id = NULL`) before removing
 * the tag, so the caller only needs to refresh the folder list and the
 * current message view on success.
 */
export function useDeleteFolder(options: UseDeleteFolderOptions = {}) {
  const { onSettled } = options
  const client = useSagClient()
  const [isLoading, setIsLoading] = useState(false)

  const deleteFolder = useCallback(
    async (folderId: string): Promise<DeleteFolderResult> => {
      setIsLoading(true)
      try {
        await client.mutate(`/messaging/api/v1/tags/${folderId}`, "DELETE")
        return { ok: true }
      } catch {
        return { ok: false }
      } finally {
        setIsLoading(false)
        onSettled?.()
      }
    },
    [client, onSettled],
  )

  return { deleteFolder, isLoading }
}
