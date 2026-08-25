"use client"

import {
  DataTableFooter,
  DataTableFooterEnd,
  DataTableFooterStart,
  Paragraph,
  Table,
  TableBody,
  TableData,
  TableHead,
  TableHeader,
  TableRow,
} from "@ogcio/design-system-react"
import {
  SelectItem,
  SelectNative,
} from "@ogcio/design-system-react/select/select-native"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useMemo } from "react"
import { ListCard } from "@/components/list-card/list-card"
import { InboxPagination } from "@/components/messages/inbox-pagination"
import { MessagesLoading } from "@/components/messages/messages-loading"
import inboxTableStyles from "@/components/messages/unified-inbox-table.module.css"
import { useUrlSearchParams } from "@/hooks/use-url-search-params"
import type { Submission } from "@/types"
import { formatDate } from "@/util/datetime"
import { pickLocalized } from "./localized"
import { SUBMISSIONS_PAGE_SIZE_OPTIONS } from "./pagination-utils"
import styles from "./submission-list-table.module.css"
import { SubmissionStatusTag } from "./submission-status-tag"

export interface SubmissionListTableProps {
  submissions: Submission[]
  isLoading: boolean
  totalPages: number
  pageSize: number
  onPageSizeChange: (size: number) => void
  onSelect: (id: string) => void
}

export function SubmissionListTable({
  submissions,
  isLoading,
  totalPages,
  pageSize,
  onPageSizeChange,
  onSelect,
}: SubmissionListTableProps) {
  const t = useTranslations("submissions")
  const tTable = useTranslations("submissions.table")
  const tInboxTable = useTranslations("home.table")
  const locale = useLocale()
  const pathname = usePathname()
  const searchParams = useUrlSearchParams()
  const searchValue = searchParams.get("search") ?? ""
  const isListLoading = isLoading && submissions.length === 0

  const columns = useMemo<ColumnDef<Submission>[]>(
    () => [
      {
        id: "id",
        accessorKey: "id",
        header: tTable("column.id"),
        cell: ({ getValue }) => (
          <span className={styles.idCell}>{getValue<string>()}</span>
        ),
      },
      {
        id: "application",
        accessorFn: (row) => pickLocalized(row.title, locale),
        header: tTable("column.submission"),
        cell: ({ row }) => (
          <Link
            href={`${pathname}?id=${row.original.id}`}
            scroll={false}
            prefetch={false}
            className={inboxTableStyles.rowLink}
          >
            <span className={inboxTableStyles.detailsText}>
              {pickLocalized(row.original.title, locale)}
            </span>
          </Link>
        ),
      },
      {
        id: "status",
        accessorKey: "status",
        header: tTable("column.status"),
        cell: ({ row }) => <SubmissionStatusTag status={row.original.status} />,
      },
      {
        id: "date",
        accessorFn: (row) => row.submittedAt ?? row.createdAt,
        header: tTable("column.date"),
        cell: ({ getValue }) => (
          <time dateTime={getValue<string>()}>
            {formatDate(getValue<string>(), "short")}
          </time>
        ),
      },
    ],
    [locale, pathname, tTable],
  )

  const table = useReactTable({
    data: submissions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
  })

  const columnSize = (id: string) =>
    (
      ({
        id: "sm-fixed",
        application: "fluid",
        status: "md-fixed",
        date: "sm-fixed",
      }) as Record<
        string,
        "xs-fixed" | "sm-fixed" | "md-fixed" | "lg-flex" | "fluid"
      >
    )[id]

  return (
    <section className={`gi-w-full ${inboxTableStyles.tableRoot}`}>
      {isListLoading ? (
        <MessagesLoading />
      ) : submissions.length > 0 ? (
        <div
          className={inboxTableStyles.listBody}
          style={
            {
              "--inbox-list-page-size": pageSize,
            } as React.CSSProperties
          }
        >
          <div className={inboxTableStyles.desktopTable}>
            <Table
              data-testid='submissions-table'
              aria-label={tTable("aria.submissionList")}
              layout='auto'
              rowSize='md'
              className={inboxTableStyles.listChromeTable}
            >
              <TableHead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHeader key={header.id} size={columnSize(header.id)}>
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
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={inboxTableStyles.clickableRow}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableData key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableData>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
              {totalPages > 0 && (
                <DataTableFooter>
                  <DataTableFooterStart>
                    <div
                      className={`${inboxTableStyles.rowsPerPage} gi-flex gi-flex-nowrap gi-items-center gi-gap-2 gi-pr-2`}
                    >
                      <span className='gi-whitespace-nowrap'>
                        {tInboxTable("rowsPerPage")}
                      </span>
                      <SelectNative
                        id='submissions-rows-per-page'
                        aria-label={tInboxTable("rowsPerPage")}
                        className={inboxTableStyles.rowsPerPageSelect}
                        value={String(pageSize)}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                          onPageSizeChange(Number(e.target.value))
                        }
                      >
                        {SUBMISSIONS_PAGE_SIZE_OPTIONS.map((size) => (
                          <SelectItem key={size} value={String(size)}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectNative>
                    </div>
                  </DataTableFooterStart>
                  <DataTableFooterEnd>
                    <InboxPagination totalPages={totalPages} variant='inline' />
                  </DataTableFooterEnd>
                </DataTableFooter>
              )}
            </Table>
          </div>

          <div className={inboxTableStyles.mobileList}>
            {submissions.map((submission) => (
              <ListCard
                key={submission.id}
                title={submission.id}
                date={formatDate(
                  submission.submittedAt ?? submission.createdAt,
                  "medium",
                )}
                preview={pickLocalized(submission.title, locale)}
                previewUnderline={false}
                onClick={() => onSelect(submission.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className={inboxTableStyles.emptyState}>
          <Paragraph>
            {searchValue ? t("empty.search") : t("empty.all")}
          </Paragraph>
        </div>
      )}

      <InboxPagination totalPages={totalPages} />
    </section>
  )
}
