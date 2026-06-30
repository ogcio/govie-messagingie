"use client"

import { useMemo } from "react"
import type { MoveDestination } from "@/types/folder"
import { useFolders } from "./use-folders"

export interface UseMessageFoldersOptions {
  /** Folder the message(s) currently live in; `null` = inbox. */
  currentFolderId: string | null
  inboxLabel: string
}

/**
 * Builds the valid move destinations for the current context from the user's
 * real folders:
 *
 * - In inbox (`currentFolderId === null`): all user folders; Inbox hidden.
 * - In a folder: Inbox (as `id: null`) plus every other folder.
 *
 * The Deleted view is never a move destination, so it is never passed here.
 */
export function useMessageFolders({
  currentFolderId,
  inboxLabel,
}: UseMessageFoldersOptions): MoveDestination[] {
  const { folders } = useFolders()

  return useMemo(() => {
    const destinations: MoveDestination[] = []

    if (currentFolderId !== null) {
      destinations.push({ id: null, label: inboxLabel })
    }

    for (const folder of folders) {
      if (folder.id !== currentFolderId) {
        destinations.push({ id: folder.id, label: folder.label })
      }
    }

    return destinations
  }, [folders, currentFolderId, inboxLabel])
}
