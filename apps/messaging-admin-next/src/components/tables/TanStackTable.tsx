"use client"

import {
  Spinner,
  Table,
  TableBody,
  TableData,
  TableHead,
  TableHeader,
  TableRow,
} from "@ogcio/design-system-react"
import { flexRender, type Table as ReactTable } from "@tanstack/react-table"
import type { ComponentProps, ReactNode } from "react"

export type TableColumnSize =
  | "xs-fixed"
  | "sm-fixed"
  | "md-fixed"
  | "lg-flex"
  | "fluid"

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    size?: TableColumnSize
    headerClassName?: string
    cellClassName?: string
  }
}

type TanStackTableProps<T> = {
  table: ReactTable<T>
  isLoading?: boolean
  emptyMessage?: string
  errorMessage?: string
  emptyClassName?: string
  "aria-label"?: string
} & Pick<ComponentProps<typeof Table>, "layout" | "noBorder">

export function TanStackTable<T>({
  table,
  isLoading = false,
  emptyMessage,
  errorMessage,
  emptyClassName,
  layout,
  noBorder,
  "aria-label": ariaLabel,
}: TanStackTableProps<T>) {
  const columnCount = table.getAllColumns().length
  const rows = table.getRowModel().rows
  const showEmpty =
    !isLoading && !errorMessage && rows.length === 0 && Boolean(emptyMessage)

  return (
    <Table layout={layout} noBorder={noBorder} aria-label={ariaLabel}>
      <TableHead>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHeader
                key={header.id}
                size={header.column.columnDef.meta?.size}
                className={header.column.columnDef.meta?.headerClassName}
              >
                {flexRender(
                  header.column.columnDef.header,
                  header.getContext(),
                )}
              </TableHeader>
            ))}
          </TableRow>
        ))}
      </TableHead>
      <TableBody>
        {isLoading && (
          <TableRow>
            <TableData
              className='gi-table-loading gi-justify-items-center'
              colSpan={columnCount}
            >
              <div className='gi-stroke-gray-950'>
                <Spinner size='xl' />
              </div>
            </TableData>
          </TableRow>
        )}
        {errorMessage && (
          <TableRow>
            <TableData colSpan={columnCount}>{errorMessage}</TableData>
          </TableRow>
        )}
        {showEmpty && (
          <TableRow>
            <TableData colSpan={columnCount} className={emptyClassName}>
              {emptyMessage}
            </TableData>
          </TableRow>
        )}
        {!isLoading &&
          !errorMessage &&
          rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => {
                const rendered = flexRender(
                  cell.column.columnDef.cell,
                  cell.getContext(),
                )
                const value =
                  rendered ?? (cell.getValue() as ReactNode | null | undefined)

                return (
                  <TableData
                    key={cell.id}
                    className={cell.column.columnDef.meta?.cellClassName}
                  >
                    {value}
                  </TableData>
                )
              })}
            </TableRow>
          ))}
      </TableBody>
    </Table>
  )
}
