"use client"

import type { ReactNode } from "react"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { MessagesDataTableHeader } from "./messages-data-table-header"
import styles from "./unified-inbox-table.module.css"

export interface InboxListChromeHeaderProps {
  /** Desktop bulk toolbar shown in place of search while rows are selected. */
  bulkActionBar?: ReactNode
  showToolbar?: boolean
  /** Defaults to the messages inbox search + filter header. */
  searchChrome?: ReactNode
}

/**
 * Fixed-height list chrome slot: search and the desktop bulk toolbar share
 * the same grid cell (inactive layer stays in layout via `visibility:
 * hidden`) so swapping them does not shift the table below.
 *
 * The swap is desktop-only: mobile hides `.headerToolbarSlot` and carries the
 * bulk actions in the table's own select-mode header, so honouring
 * `showToolbar` there would hide search with nothing taking its place.
 */
export function InboxListChromeHeader({
  bulkActionBar,
  showToolbar = false,
  searchChrome = <MessagesDataTableHeader />,
}: InboxListChromeHeaderProps) {
  const isMobile = useIsMobile()
  const showBulkToolbar = showToolbar && !isMobile

  return (
    <div className={`gi-w-full ${styles.dataTableHeaderChrome}`}>
      <div className={styles.listChromeHeader}>
        <div
          aria-hidden={showBulkToolbar}
          className={
            showBulkToolbar ? styles.listChromeHeaderInactive : undefined
          }
        >
          {searchChrome}
        </div>
        <div
          className={`${styles.headerToolbarSlot} ${showBulkToolbar ? "" : styles.listChromeHeaderInactive}`}
        >
          {showBulkToolbar ? (
            bulkActionBar
          ) : (
            <div className={styles.headerToolbarPlaceholder} aria-hidden />
          )}
        </div>
      </div>
    </div>
  )
}
