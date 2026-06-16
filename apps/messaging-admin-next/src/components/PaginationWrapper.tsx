"use client"

import { Pagination } from "@ogcio/design-system-react"
import { useRouter, useSearchParams } from "next/navigation"

export default function PaginationWrapper(props: {
  currentPage: number
  totalPages: number
  size: number
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentPage = Number(searchParams.get("page")) + 1 || props.currentPage
  const size = Number(searchParams.get("size")) || props.size

  const handlePageChange = (page: number) => {
    const sp = new URLSearchParams(searchParams)
    sp.set("page", (page - 1).toString())
    sp.set("size", size.toString())
    router.push(`?${sp.toString()}`)
  }

  return (
    <Pagination
      currentPage={currentPage}
      totalPages={props.totalPages}
      onPageChange={handlePageChange}
    />
  )
}
