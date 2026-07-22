"use client"

import type { ReactNode } from "react"
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
 */
export function InboxListChromeHeader({
  bulkActionBar,
  showToolbar = false,
  searchChrome = <MessagesDataTableHeader />,
}: InboxListChromeHeaderProps) {
  return (
    <div className={`gi-w-full ${styles.dataTableHeaderChrome}`}>
      <div className={styles.listChromeHeader}>
        <div
          aria-hidden={showToolbar}
          className={showToolbar ? styles.listChromeHeaderInactive : undefined}
        >
          {searchChrome}
        </div>
        <div
          className={`${styles.headerToolbarSlot} ${showToolbar ? "" : styles.listChromeHeaderInactive}`}
        >
          {showToolbar ? (
            bulkActionBar
          ) : (
            <div className={styles.headerToolbarPlaceholder} aria-hidden />
          )}
        </div>
      </div>
    </div>
  )
}
