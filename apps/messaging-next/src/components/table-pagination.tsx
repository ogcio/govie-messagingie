"use client"

import { IconButton } from "@ogcio/design-system-react"
import {
  SelectItem,
  SelectNative,
} from "@ogcio/design-system-react/select/select-native"

export type TablePaginationProps = {
  align?: "start" | "center" | "end"
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

const alignClass = {
  start: "gi-justify-first",
  center: "gi-justify-center",
  end: "gi-justify-end",
} as const

export function TablePagination({
  currentPage,
  totalPages,
  onPageChange,
  align = "end",
}: TablePaginationProps) {
  const goPrev = () => {
    if (currentPage > 1) onPageChange(currentPage - 1)
  }

  const goNext = () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1)
  }

  return (
    <div className={`${alignClass[align]} gi-table-pagination`}>
      <IconButton
        disabled={currentPage === 1}
        onClick={() => onPageChange(1)}
        appearance='dark'
        variant='flat'
        className='gi-mr-2'
        icon={{ icon: "first_page" }}
      />
      <IconButton
        disabled={currentPage === 1}
        onClick={goPrev}
        appearance='dark'
        variant='flat'
        className='gi-mr-2'
        icon={{ icon: "chevron_left" }}
      />
      <div
        className='gi-table-pagination-label gi-space-x-2'
        aria-live='polite'
      >
        <span>Page</span>
        <SelectNative
          aria-label='Select page'
          value={currentPage}
          className='!gi-min-w-12 !gi-border-color-border-system-neutral-interactive-muted'
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            onPageChange(Number(e.target.value))
          }
        >
          {Array.from({ length: totalPages }, (_, i) => {
            const page = i + 1
            return (
              <SelectItem key={`page-${page}`} value={page}>
                {page}
              </SelectItem>
            )
          })}
        </SelectNative>
        <span>{`of ${totalPages}`}</span>
      </div>
      <IconButton
        onClick={goNext}
        disabled={currentPage === totalPages}
        appearance='dark'
        variant='flat'
        className='gi-ml-2'
        icon={{ icon: "chevron_right" }}
      />
      <IconButton
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(totalPages)}
        appearance='dark'
        variant='flat'
        className='gi-ml-2'
        icon={{ icon: "last_page" }}
      />
    </div>
  )
}
