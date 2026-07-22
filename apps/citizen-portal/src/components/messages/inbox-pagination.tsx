"use client"

import { TablePagination } from "@ogcio/design-system-react/table/table-pagination"
import { usePathname, useRouter } from "next/navigation"
import { useUrlSearchParams } from "@/hooks/use-url-search-params"
import styles from "./inbox-pagination.module.css"

export interface InboxPaginationProps {
  totalPages: number
  /**
   * `footer` — centred bar with mobile sticky treatment (card lists).
   * `inline` — bare `TablePagination` for embedding in a table footer.
   */
  variant?: "footer" | "inline"
  className?: string
}

/**
 * Shared inbox pagination: the DS `TablePagination` chip used by the
 * messages unified inbox, wired to the `page` query param on the current
 * route. Hidden when `totalPages <= 1`.
 */
export function InboxPagination({
  totalPages,
  variant = "footer",
  className,
}: InboxPaginationProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useUrlSearchParams()
  const currentPage = Number(searchParams.get("page")) || 1

  if (totalPages <= 1) return null

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams)
    params.set("page", String(page))
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  const pagination = (
    <TablePagination
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={handlePageChange}
    />
  )

  if (variant === "inline") {
    return pagination
  }

  return (
    <div
      className={[styles.footer, className].filter(Boolean).join(" ")}
      data-inbox-pagination-footer
    >
      {pagination}
    </div>
  )
}
