"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { Message } from "@/types"

export interface MessageSelection {
  selectedIds: Set<string>
  selectedCount: number
  isSelected: (id: string) => boolean
  toggle: (id: string) => void
  toggleAll: () => void
  clear: () => void
  allSelected: boolean
  someSelected: boolean
}

/**
 * Tracks which messages on the current page are checked. Select-all and
 * toggle-all operate on the visible rows only, matching the Gmail-style
 * behaviour agreed for the RFC (Select All = current page).
 */
export function useMessageSelection(messages: Message[]): MessageSelection {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  const visibleIds = useMemo(() => messages.map((m) => m.id), [messages])

  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev
      const next = new Set<string>()
      for (const id of prev) {
        if (visibleIds.includes(id)) next.add(id)
      }
      return next.size === prev.size ? prev : next
    })
  }, [visibleIds])

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  )

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const allSelected = useMemo(
    () => visibleIds.length > 0 && selectedIds.size === visibleIds.length,
    [visibleIds, selectedIds],
  )

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === visibleIds.length) return new Set()
      return new Set(visibleIds)
    })
  }, [visibleIds])

  const clear = useCallback(() => {
    setSelectedIds((prev) => (prev.size === 0 ? prev : new Set()))
  }, [])

  const someSelected = selectedIds.size > 0 && !allSelected

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    isSelected,
    toggle,
    toggleAll,
    clear,
    allSelected,
    someSelected,
  }
}
