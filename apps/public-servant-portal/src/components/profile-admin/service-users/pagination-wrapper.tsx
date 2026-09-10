"use client"

import { Pagination } from "@ogcio/design-system-react"
import { useRouter, useSearchParams } from "next/navigation"

export function PaginationWrapper({
  currentPage,
  totalPages,
  size,
}: {
  currentPage: number
  totalPages: number
  size: number
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resolvedCurrent =
    Number(searchParams.get("page")) + 1 || currentPage || 1

  const handlePageChange = (page: number) => {
    const sp = new URLSearchParams(searchParams)
    sp.set("page", (page - 1).toString())
    sp.set("size", size.toString())
    router.push(`?${sp.toString()}`)
  }

  return (
    <Pagination
      currentPage={resolvedCurrent}
      totalPages={totalPages}
      onPageChange={handlePageChange}
    />
  )
}
