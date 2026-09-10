"use client"

import { Stack } from "@ogcio/design-system-react"
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { TanStackTable } from "@/components/tables/TanStackTable"
import { PAGINATION_LIMIT_DEFAULT } from "@/const"
import type { ApiServiceUserImportProfileDetail } from "@/types"
import { PaginationWrapper } from "./pagination-wrapper"
import { StatusTag } from "./status-tag"

export function ServiceUsersImportDetailsTable({
  details,
  paging,
}: {
  details: ApiServiceUserImportProfileDetail[]
  paging: { totalPages: number; currentPage: number }
}) {
  const t = useTranslations("serviceUserImport")

  const columns = useMemo<ColumnDef<ApiServiceUserImportProfileDetail>[]>(
    () => [
      {
        id: "recipient",
        header: t("table.columns.recipient"),
        meta: { size: "fluid" },
        accessorFn: (row) =>
          `${row.firstName ?? ""} ${row.lastName ?? ""} <${row.email ?? ""}>`,
      },
      {
        id: "status",
        header: t("table.columns.status"),
        meta: { size: "sm-fixed" },
        cell: ({ row }) => (
          <StatusTag status={row.original.status ?? undefined} />
        ),
      },
    ],
    [t],
  )

  const table = useReactTable({
    data: details,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <Stack direction='column' gap={10}>
      <Stack direction='column' gap={10}>
        <div className='table-scroll-wrapper'>
          <TanStackTable
            table={table}
            emptyMessage={t("table.noResults")}
            aria-label={t("table.columns.recipient")}
          />
        </div>
      </Stack>
      {paging.totalPages > 1 && (
        <PaginationWrapper
          currentPage={paging.currentPage}
          totalPages={paging.totalPages}
          size={PAGINATION_LIMIT_DEFAULT}
        />
      )}
    </Stack>
  )
}
