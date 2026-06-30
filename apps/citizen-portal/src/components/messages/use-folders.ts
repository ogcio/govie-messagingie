"use client"

import { useGatewayFetch } from "@ogcio/sag-client/react"
import { useMemo } from "react"
import type { Folder } from "@/types/folder"

/**
 * Subset of the `GET /messaging/api/v1/tags` response we consume. The API
 * returns the full tag record (path, parentTagId, timestamps); the folder
 * UI only needs id + label and relies on the backend's `ORDER BY label`
 * for the alphabetical ordering the design calls for.
 */
interface TagApiItem {
  id: string
  label: string
  parentTagId: string | null
}

export const TAGS_URL = "/messaging/api/v1/tags"

export interface UseFoldersResult {
  folders: Folder[]
  isLoading: boolean
  error: unknown
  refresh: () => void
}

/**
 * Fetches the logged-in user's folders (tags) from the gateway. Replaces
 * the former `getMockFolders()` fixtures. The list is already sorted
 * alphabetically server-side.
 */
export function useFolders(): UseFoldersResult {
  const { data, isLoading, error, refresh } =
    useGatewayFetch<TagApiItem[]>(TAGS_URL)

  const folders = useMemo<Folder[]>(() => {
    if (!data) return []
    return data.map((tag) => ({ id: tag.id, label: tag.label }))
  }, [data])

  return {
    folders,
    isLoading,
    error,
    refresh: () => {
      void refresh()
    },
  }
}
