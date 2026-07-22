"use client"

import {
  DataTableHeader,
  DataTableHeaderSearch,
} from "@ogcio/design-system-react"
import { memo } from "react"
import { InboxListSearchField } from "./inbox-list-search-field"

/**
 * Shared inbox-style search chrome for URL-driven lists (e.g. applications).
 * Mounted as a sibling of the list table so it stays mounted while data
 * refetches.
 */
export const InboxSearch = memo(function InboxSearch() {
  return (
    <DataTableHeader>
      <DataTableHeaderSearch>
        <InboxListSearchField />
      </DataTableHeaderSearch>
    </DataTableHeader>
  )
})
