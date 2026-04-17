"use client"

import { Pagination } from "@ogcio/design-system-react"
import { useRouter, useSearchParams } from "next/navigation"

export function PaginationWrapper({ totalPages }: { totalPages: number }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentPage = Number(searchParams.get("page")) || 1

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams)
    params.set("page", String(page))
    router.push(`?${params.toString()}`)
  }

  if (totalPages <= 1) return null

  return (
    <Pagination
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={handlePageChange}
    />
  )
}
