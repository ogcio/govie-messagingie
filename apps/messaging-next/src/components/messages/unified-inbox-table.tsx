"use client"

import {
  Button,
  DataTableFooter,
  DataTableFooterEnd,
  DataTableFooterStart,
  DataTableHeader,
  DataTableHeaderSearch,
  InputText,
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
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AttachFileIcon, RefreshIcon } from "@/components/icons"
import { TablePagination } from "@/components/table-pagination"
import type { Message } from "@/types"
import { formatDate } from "@/util/datetime"
import styles from "./unified-inbox-table.module.css"

export interface UnifiedInboxTableProps {
  messages: Message[]
  isLoading: boolean
  totalCount?: number
  onSelect: (id: string) => void
  pageSize: number
  onPageSizeChange: (size: number) => void
}

export function UnifiedInboxTable({
  messages,
  isLoading,
  totalCount,
  onSelect,
  pageSize,
  onPageSizeChange,
}: UnifiedInboxTableProps) {
  const t = useTranslations("home.table")
  const tSearch = useTranslations("search")
  const router = useRouter()
  const searchParams = useSearchParams()

  const searchValue = searchParams.get("search") ?? ""
  const [draftSearch, setDraftSearch] = useState(searchValue)
  const currentPage = Number(searchParams.get("page")) || 1
  const totalPages = Math.ceil((totalCount ?? 0) / pageSize)

  useEffect(() => {
    setDraftSearch(searchValue)
  }, [searchValue])

  const pushSearch = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams)
      params.delete("page")

      if (value.trim()) {
        params.set("search", value.trim())
      } else {
        params.delete("search")
      }
      router.push(`?${params.toString()}`)
    },
    [router, searchParams],
  )

  const handleSearch = () => {
    pushSearch(draftSearch)
  }

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams)
    params.set("page", String(page))
    router.push(`?${params.toString()}`)
  }

  const unreadCount = useMemo(
    () => messages.filter((msg) => !msg.isSeen).length,
    [messages],
  )

  const columns = useMemo<ColumnDef<Message>[]>(
    () => [
      {
        id: "sender",
        accessorFn: (row) => row.threadName ?? t("unknownSender"),
        header: t("column.sender"),
        cell: ({ getValue }) => (
          <span className={styles.senderCell}>{getValue<string>()}</span>
        ),
      },
      {
        id: "details",
        accessorKey: "subject",
        header: t("column.details"),
        cell: ({ row }) => (
          <span className={styles.detailsText}>{row.original.subject}</span>
        ),
      },
      {
        id: "attachment",
        accessorKey: "attachmentsCount",
        header: "",
        cell: ({ row }) =>
          row.original.attachmentsCount ? (
            <span className={styles.attachmentIcon}>
              <AttachFileIcon
                aria-label={`${row.original.attachmentsCount} ${t("attachment", { count: row.original.attachmentsCount })}`}
              />
            </span>
          ) : null,
      },
      {
        id: "date",
        accessorKey: "createdAt",
        header: t("column.date"),
        cell: ({ getValue }) => (
          <time dateTime={getValue<string>()}>
            {formatDate(getValue<string>(), "short")}
          </time>
        ),
      },
    ],
    [t],
  )

  const table = useReactTable({
    data: messages,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
  })

  return (
    <section className={styles.container}>
      <DataTableHeader>
        <DataTableHeaderSearch>
          <div className={styles.searchRow}>
            <InputText
              data-testid='search-input'
              type='text'
              placeholder={tSearch("input.placeholder")}
              value={draftSearch}
              aria-label={tSearch("button.search")}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setDraftSearch(e.target.value)
              }
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === "Enter") handleSearch()
              }}
            />
            <Button onClick={handleSearch}>{tSearch("button.search")}</Button>
          </div>
        </DataTableHeaderSearch>
      </DataTableHeader>

      {!isLoading && unreadCount > 0 ? (
        <div className={styles.unreadCount}>
          {t("unreadCount", { count: unreadCount })}
        </div>
      ) : null}

      {isLoading ? (
        <div className={styles.loadingState}>
          <RefreshIcon className='gi-animate-spin' />
          <span>{t("loading")}</span>
        </div>
      ) : messages.length > 0 ? (
        <>
          <div className={styles.desktopTable}>
            <Table
              data-testid='unified-inbox-table'
              aria-label={t("aria.messageList")}
            >
              <TableHead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHeader
                        key={header.id}
                        size={
                          (
                            {
                              sender: "md-fixed",
                              details: "fluid",
                              attachment: "xs-fixed",
                              date: "sm-fixed",
                            } as Record<
                              string,
                              | "xs-fixed"
                              | "sm-fixed"
                              | "md-fixed"
                              | "lg-flex"
                              | "fluid"
                            >
                          )[header.id]
                        }
                        align={
                          header.id === "attachment" ? "center" : undefined
                        }
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
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={`${styles.clickableRow} ${row.original.isSeen ? "" : styles.unreadRow}`}
                    onClick={() => onSelect(row.original.id)}
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
                      className={`${styles.rowsPerPage} gi-flex gi-flex-nowrap gi-items-center gi-gap-2 gi-pr-2`}
                    >
                      <span className='gi-whitespace-nowrap'>
                        {t("rowsPerPage")}
                      </span>
                      <SelectNative
                        id='rows-per-page'
                        aria-label={t("rowsPerPage")}
                        className='!gi-min-w-12 !gi-w-full !gi-border-color-border-system-neutral-interactive-muted'
                        value={String(pageSize)}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                          onPageSizeChange(Number(e.target.value))
                        }
                      >
                        <SelectItem value='6'>6</SelectItem>
                        <SelectItem value='10'>10</SelectItem>
                        <SelectItem value='20'>20</SelectItem>
                        <SelectItem value='50'>50</SelectItem>
                      </SelectNative>
                    </div>
                  </DataTableFooterStart>
                  <DataTableFooterEnd>
                    <TablePagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={handlePageChange}
                    />
                  </DataTableFooterEnd>
                </DataTableFooter>
              )}
            </Table>
          </div>

          <div className={styles.mobileList}>
            {messages.map((message) => (
              <MobileMessageRow
                key={message.id}
                message={message}
                onSelect={onSelect}
              />
            ))}
          </div>
        </>
      ) : (
        <div className={styles.emptyState}>
          <Paragraph>
            {searchValue ? t("empty.search") : t("empty.all")}
          </Paragraph>
        </div>
      )}

      {totalPages > 0 && (
        <div className={styles.mobileFooter}>
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </section>
  )
}

function MobileMessageRow({
  message,
  onSelect,
}: {
  message: Message
  onSelect: (id: string) => void
}) {
  const t = useTranslations("home.table")
  const from = message.threadName ?? t("unknownSender")
  const shortDate = formatDate(message.createdAt, "short")

  return (
    <button
      type='button'
      onClick={() => onSelect(message.id)}
      className={`${styles.mobileRow} ${message.isSeen ? "" : styles.unreadRow}`}
    >
      <span className='gi-sr-only'>
        {message.isSeen ? t("filter.read") : t("filter.unread")}
      </span>
      <div className={styles.mobileRowTop}>
        <span className={styles.mobileSender}>{from}</span>
        <time className={styles.mobileDate} dateTime={message.createdAt}>
          {shortDate}
        </time>
      </div>
      <div className={styles.mobileSubjectRow}>
        <span className={styles.mobileSubject}>{message.subject}</span>
        {message.attachmentsCount ? (
          <span className={styles.mobileAttachment}>
            <AttachFileIcon aria-hidden='true' />
          </span>
        ) : null}
      </div>
    </button>
  )
}
