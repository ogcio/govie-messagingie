"use client"

import {
  Button,
  DataTableFooter,
  DataTableFooterEnd,
  DataTableFooterStart,
  DataTableHeader,
  DataTableHeaderSearch,
  Icon,
  InputCheckbox,
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
import { TablePagination } from "@ogcio/design-system-react/table/table-pagination"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import { CheckboxIndicatorIcon, SearchIcon } from "@/components/icons"
import type { Message } from "@/types"
import { formatDate } from "@/util/datetime"
import { MessagesLoading } from "./messages-loading"
import { SenderName } from "./sender-name"
import styles from "./unified-inbox-table.module.css"
import type { MessageSelection } from "./use-message-selection"

/**
 * Props the DS `InputCheckbox` exposes that we reuse for the table's
 * select-all and per-row checkboxes. DS toggles the `.gi-checkbox-indeterminate`
 * class when `indeterminate=true`, but the dash-on-fill visual it targets is
 * scoped to `:checked:before`, so we force `checked=true` whenever either the
 * row is fully selected OR the page is in mixed state. The accompanying
 * `aria-checked='mixed'` preserves the correct screen-reader announcement —
 * DS does NOT imperatively flip `HTMLInputElement.indeterminate`, only the
 * class name.
 */
function selectionCheckboxProps(args: {
  allSelected: boolean
  someSelected: boolean
}) {
  const { allSelected, someSelected } = args
  const indeterminate = someSelected && !allSelected
  return {
    size: "sm" as const,
    checked: allSelected || indeterminate,
    indeterminate,
    "aria-checked": indeterminate ? ("mixed" as const) : !!allSelected,
  }
}

export interface UnifiedInboxTableProps {
  messages: Message[]
  isLoading: boolean
  totalCount?: number
  onSelect: (id: string) => void
  pageSize: number
  onPageSizeChange: (size: number) => void
  selection?: MessageSelection
  selectMode?: boolean
  onEnterSelectMode?: () => void
  onExitSelectMode?: () => void
  /**
   * Desktop-only bulk-action banner. Rendered directly below the search
   * row where the unread-count line normally sits; hidden on mobile via
   * CSS. Mobile surfaces the same actions inline in the select-mode
   * header (see `onBulkDelete` below) so the two viewports never stack
   * duplicate controls.
   */
  bulkActionBar?: ReactNode
  /**
   * Handler invoked by the mobile select-mode header's Delete button.
   * Kept here (rather than on the selection object) because the delete
   * workflow — opening the confirmation modal, clearing selection on
   * success, showing alerts — lives in the parent `UnifiedInboxListView`
   * and the table is purely presentational.
   */
  onBulkDelete?: () => void
  /**
   * Opens the mobile folder panel. When provided, a `Folders` button is
   * rendered in the non-select mobile header (the desktop sidebar that hosts
   * folder navigation is hidden on mobile).
   */
  onOpenFolders?: () => void
  /**
   * Opens the move picker from the mobile select-mode header. Rendered only
   * when `canMove` is also true (i.e. there is at least one valid
   * destination folder and the current view is not Deleted).
   */
  onBulkMove?: () => void
  canMove?: boolean
}

export function UnifiedInboxTable({
  messages,
  isLoading,
  totalCount,
  onSelect,
  pageSize,
  onPageSizeChange,
  selection,
  selectMode = false,
  onEnterSelectMode,
  onExitSelectMode,
  bulkActionBar,
  onBulkDelete,
  onOpenFolders,
  onBulkMove,
  canMove = false,
}: UnifiedInboxTableProps) {
  const t = useTranslations("home.table")
  const tSearch = useTranslations("search")
  const tToolbar = useTranslations("home.delete.toolbar")
  const tMove = useTranslations("home.move")
  const tFolders = useTranslations("home.folders")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const searchValue = searchParams.get("search") ?? ""
  const [draftSearch, setDraftSearch] = useState(searchValue)
  const currentPage = Number(searchParams.get("page")) || 1
  const totalPages = Math.ceil((totalCount ?? 0) / pageSize)

  useEffect(() => {
    setDraftSearch(searchValue)
  }, [searchValue])

  /**
   * Push the URL for a new search/page state.
   *
   * Next.js App Router quirk: `router.push("?")` (empty query string,
   * relative URL) is treated as a no-op — same path, same `(empty) query`
   * key, so the router never re-fires and `useSearchParams()` keeps its
   * previous value. That's the bug behind "clearing the search input +
   * Enter does nothing": when the user empties the box we'd build an
   * empty `URLSearchParams` and push `"?"`, which never actually drops
   * the `?search=...` segment. Falling back to the bare `pathname`
   * whenever there are no remaining params forces a real navigation
   * that strips the entire query string in one go.
   */
  const pushQuery = useCallback(
    (params: URLSearchParams) => {
      const qs = params.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname)
    },
    [router, pathname],
  )

  const pushSearch = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams)
      params.delete("page")

      if (value.trim()) {
        params.set("search", value.trim())
      } else {
        params.delete("search")
      }
      pushQuery(params)
    },
    [searchParams, pushQuery],
  )

  const handleSearch = () => {
    pushSearch(draftSearch)
  }

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams)
    params.set("page", String(page))
    pushQuery(params)
  }

  const unreadCount = useMemo(
    () => messages.filter((msg) => !msg.isSeen).length,
    [messages],
  )

  const selectionEnabled = Boolean(selection)
  /*
   * Mobile "select mode" has two entry points:
   *   1. explicit user tap on the mobile "Select" button (-> selectMode=true)
   *   2. an inherited non-empty selection from a wider viewport where the
   *      desktop table's always-visible checkboxes were used.
   * Without (2), switching from desktop to mobile with items already selected
   * leaves the bulk-action banner showing but the mobile rows rendered in
   * their non-select visual (no checkbox, no highlight, row taps open the
   * message), which reads as a broken/out-of-sync state. Deriving the
   * effective flag here keeps the mobile select-all header and each row's
   * appearance in lockstep with the real selection state.
   */
  const effectiveSelectMode =
    selectMode || Boolean(selection && selection.selectedCount > 0)

  const columns = useMemo<ColumnDef<Message>[]>(() => {
    const cols: ColumnDef<Message>[] = []

    if (selectionEnabled && selection) {
      cols.push({
        id: "select",
        header: () => (
          <InputCheckbox
            {...selectionCheckboxProps({
              allSelected: selection.allSelected,
              someSelected: selection.someSelected,
            })}
            aria-label={t("ariaLabel.selectAll")}
            onChange={() => selection.toggleAll()}
            data-testid='select-all-checkbox'
          />
        ),
        cell: ({ row }) => (
          <InputCheckbox
            size='sm'
            /*
             * The aria-label is synchronous, but the human-readable
             * sender name is fetched per-org on render (see
             * `<SenderName>`), so we can't surface it here without
             * plumbing a parent-level lookup map. The subject already
             * uniquely identifies the row for screen-reader users; we
             * intentionally fall back to the localized "Unknown
             * sender" string instead of leaking the raw `organisationId`
             * UUID or echoing the subject (which used to ship through
             * `threadName` and was the original "Sender shows the
             * subject" bug).
             */
            aria-label={t("ariaLabel.selectRow", {
              sender: t("unknownSender"),
              subject: row.original.subject,
            })}
            checked={selection.isSelected(row.original.id)}
            onChange={() => selection.toggle(row.original.id)}
            onClick={(e) => e.stopPropagation()}
            data-testid={`select-row-${row.original.id}`}
          />
        ),
      })
    }

    cols.push(
      {
        id: "sender",
        /*
         * The messaging-api list endpoint only exposes `organisationId`
         * (a UUID), never a human-readable sender name. Resolution to a
         * localized name happens client-side per row inside
         * `<SenderName>` against `/profile/api/v1/organisations/{id}`,
         * with SWR deduping rows that share an org down to a single
         * request per page. The accessor is kept on `organisationId`
         * purely so react-table's row model has a stable scalar value
         * for the column — sorting and filtering by raw UUID are not
         * exposed in the UI.
         */
        accessorFn: (row) => row.organisationId,
        header: t("column.sender"),
        cell: ({ row }) => (
          <SenderName
            organisationId={row.original.organisationId}
            className={styles.senderCell}
          />
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
            <span className='gi-inline-flex gi-items-center gi-justify-center gi-text-gray-600'>
              <Icon
                icon='attach_file'
                ariaLabel={`${row.original.attachmentsCount} ${t("attachment", { count: row.original.attachmentsCount })}`}
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
    )

    return cols
  }, [selectionEnabled, selection, t])

  const table = useReactTable({
    data: messages,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
  })

  const columnSize = (id: string) =>
    (
      ({
        select: "xs-fixed",
        sender: "md-fixed",
        details: "fluid",
        attachment: "xs-fixed",
        date: "sm-fixed",
      }) as Record<
        string,
        "xs-fixed" | "sm-fixed" | "md-fixed" | "lg-flex" | "fluid"
      >
    )[id]

  const showBulkActionBar = Boolean(bulkActionBar)
  const mobileInSelectMode = Boolean(effectiveSelectMode && selection)
  const isInitialLoading = isLoading && messages.length === 0

  if (isInitialLoading) {
    return (
      <section className={`gi-w-full ${styles.tableRoot}`}>
        <MessagesLoading />
      </section>
    )
  }

  return (
    <section
      className={`gi-w-full ${styles.tableRoot} ${showBulkActionBar ? styles.containerWithBanner : ""}`}
    >
      {/*
       * Search row. Always mounted (desktop + mobile) so the URL-synced
       * draft value, focus and in-flight input state survive a
       * select → clear round-trip without being remounted. The mobile
       * layout mirrors desktop — search input + trailing lens IconButton
       * in a single row — instead of the old "hide the searchbar when a
       * banner is active" trick.
       */}
      <div className='gi-w-full'>
        <DataTableHeader>
          <DataTableHeaderSearch>
            <div className={styles.searchRow}>
              {/*
               * Use the DS InputText's native `iconEnd` slot for the
               * lens. DS reserves the right-edge padding internally
               * (`data-icon-end` on the inner <input>), wraps the icon
               * in `.gi-input-text-icon-end` and forwards clicks via
               * `onIconEndClick`, so the icon always lines up inside
               * the field on every breakpoint without a bespoke
               * absolute-position wrapper. Enter on the input still
               * submits via `onKeyDown` below; the click handler
               * covers pointer users.
               */}
              <InputText
                data-testid='search-input'
                type='text'
                placeholder={tSearch("input.placeholder")}
                value={draftSearch}
                aria-label={tSearch("button.search")}
                /*
                 * DS gap (small-size Material Symbols): routing the
                 * lens through `inputActionButton` forced the inner
                 * IconButton to `size: "small"` → `<Icon size="sm" />`
                 * → 16px Material Symbols glyph. DS doesn't ship an
                 * inline-SVG `search` atom (only `close` / `visibility`
                 * / chevrons / etc.), and the Material Symbols web
                 * font `LoadMaterialSymbols` preloads is only
                 * variable in the `opsz 20..48` range — so at 16px
                 * the browser clamped `opsz` out of range and the
                 * glyph rendered too thin and too small to read.
                 *
                 * `iconEnd` sits in the same right-edge slot and
                 * accepts a ReactNode directly, which lets us hand it
                 * a proper inline SVG port of the same Material
                 * Symbols outlined `search` glyph (see
                 * `components/icons/search.tsx`). The SVG renders
                 * crisply at any size, doesn't depend on the Material
                 * Symbols font being loaded, and keeps DS's own
                 * `.gi-input-text-icon-end` positioning + the
                 * `data-icon-end` padding offset on the input. Click
                 * is wired via `onIconEndClick`; Enter still submits
                 * via `onKeyDown` for keyboard users.
                 */
                iconEnd={<SearchIcon size='md' />}
                onIconEndClick={handleSearch}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setDraftSearch(e.target.value)
                }
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === "Enter") handleSearch()
                }}
              />
            </div>
          </DataTableHeaderSearch>
        </DataTableHeader>
      </div>

      {/*
       * Desktop bulk-action banner. Rendered in the slot directly below
       * the search row where the unread-count line normally sits. Hidden
       * via CSS on mobile — mobile surfaces the same actions inside the
       * select-mode header below so the banner and the row don't
       * duplicate `bulk-delete-button`-style controls on small screens.
       */}
      {showBulkActionBar ? (
        <div className={styles.bannerSlot}>{bulkActionBar}</div>
      ) : null}

      {!isLoading && messages.length > 0 ? (
        <div
          className={`${styles.mobileSelectHeader} ${mobileInSelectMode ? styles.mobileSelectHeaderDark : ""}`}
        >
          {mobileInSelectMode && selection ? (
            <>
              <span className='gi-inline-flex gi-items-center gi-gap-3'>
                <InputCheckbox
                  {...selectionCheckboxProps({
                    allSelected: selection.allSelected,
                    someSelected: selection.someSelected,
                  })}
                  aria-label={t("ariaLabel.selectAll")}
                  data-testid='mobile-select-all-checkbox'
                  onChange={() => selection.toggleAll()}
                />
                <span className={styles.mobileSelectedCount} aria-live='polite'>
                  {tToolbar("selectedCount", {
                    count: selection.selectedCount,
                  })}
                </span>
              </span>
              <span className='gi-inline-flex gi-items-center gi-gap-2'>
                {canMove && onBulkMove ? (
                  <Button
                    data-testid='bulk-move-button-mobile'
                    variant='secondary'
                    appearance='light'
                    size='small'
                    disabled={selection.selectedCount === 0}
                    onClick={() => {
                      if (selection.selectedCount === 0) return
                      onBulkMove()
                    }}
                  >
                    {tMove("moveTo")}
                  </Button>
                ) : null}
                <Button
                  data-testid='bulk-delete-button-mobile'
                  variant='secondary'
                  appearance='light'
                  size='small'
                  disabled={selection.selectedCount === 0}
                  onClick={() => {
                    if (selection.selectedCount === 0) return
                    onBulkDelete?.()
                  }}
                >
                  {tToolbar("delete")}
                </Button>
                <Button
                  data-testid='mobile-select-close'
                  variant='secondary'
                  appearance='light'
                  size='small'
                  className={styles.mobileCloseButton}
                  onClick={() => {
                    selection.clear()
                    onExitSelectMode?.()
                  }}
                >
                  {/*
                   * "Close ×" label: DS `Icon icon="close"` is served
                   * from DS's built-in SVG lookup (no Material Symbols
                   * font dependency), so the glyph renders reliably
                   * alongside the text. The inner span gives us the
                   * inline-flex gap between the label and the icon
                   * without leaking styling onto the Button itself.
                   */}
                  <span className='gi-inline-flex gi-items-center gi-gap-1'>
                    {t("close")}
                    <Icon icon='close' size='sm' />
                  </span>
                </Button>
              </span>
            </>
          ) : (
            <>
              {unreadCount > 0 ? (
                <span className={styles.unreadCount}>
                  {t("unreadCount", { count: unreadCount })}
                </span>
              ) : (
                <span aria-hidden='true' />
              )}
              <span className='gi-inline-flex gi-items-center gi-gap-2'>
                {onOpenFolders ? (
                  <Button
                    data-testid='mobile-folders-button'
                    variant='secondary'
                    appearance='default'
                    size='small'
                    onClick={onOpenFolders}
                  >
                    {tFolders("panel.open")}
                  </Button>
                ) : null}
                {onEnterSelectMode ? (
                  <Button
                    data-testid='mobile-select-button'
                    variant='secondary'
                    appearance='default'
                    size='small'
                    onClick={onEnterSelectMode}
                  >
                    {t("select")}
                  </Button>
                ) : null}
              </span>
            </>
          )}
        </div>
      ) : null}

      {/*
       * Desktop-only unread count. Hidden on mobile via the module CSS
       * (.unreadCountDesktop display:none at <768px) and suppressed
       * entirely when the banner is showing, since the banner sits in
       * this slot on desktop.
       */}
      {!isLoading && !showBulkActionBar && unreadCount > 0 ? (
        <div className={styles.unreadCountDesktop}>
          {t("unreadCount", { count: unreadCount })}
        </div>
      ) : null}

      {isLoading ? (
        <MessagesLoading />
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
                        size={columnSize(header.id)}
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
                    className={`${styles.clickableRow} ${row.original.isSeen ? "" : styles.unreadRow} ${selection?.isSelected(row.original.id) ? styles.selectedRow : ""}`}
                    onClick={() => onSelect(row.original.id)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableData
                        key={cell.id}
                        onClick={
                          cell.column.id === "select"
                            ? (e: React.MouseEvent) => e.stopPropagation()
                            : undefined
                        }
                      >
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
                        className={styles.rowsPerPageSelect}
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
                selection={selection}
                selectMode={effectiveSelectMode}
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
  selection,
  selectMode,
}: {
  message: Message
  onSelect: (id: string) => void
  selection?: MessageSelection
  selectMode?: boolean
}) {
  const t = useTranslations("home.table")
  const shortDate = formatDate(message.createdAt, "short")

  const inSelectMode = Boolean(selectMode && selection)
  const isChecked = selection?.isSelected(message.id) ?? false

  const handleClick = () => {
    if (inSelectMode && selection) {
      selection.toggle(message.id)
      return
    }
    onSelect(message.id)
  }

  return (
    <button
      type='button'
      onClick={handleClick}
      className={`${styles.mobileRow} ${message.isSeen ? "" : styles.unreadRow} ${inSelectMode && isChecked ? styles.mobileRowSelected : ""}`}
      aria-pressed={inSelectMode ? isChecked : undefined}
    >
      <span className='gi-sr-only'>
        {message.isSeen ? t("filter.read") : t("filter.unread")}
      </span>
      {inSelectMode ? (
        <span
          className={styles.mobileCheckbox}
          aria-hidden='true'
          data-testid={`mobile-select-indicator-${message.id}`}
        >
          <CheckboxIndicatorIcon checked={isChecked} size='md' />
        </span>
      ) : null}
      <div className='gi-flex gi-flex-col gi-gap-1 gi-flex-1 gi-min-w-0'>
        <div className={styles.mobileRowTop}>
          <SenderName
            organisationId={message.organisationId}
            className={styles.mobileSender}
          />
          <time className={styles.mobileDate} dateTime={message.createdAt}>
            {shortDate}
          </time>
        </div>
        <div className='gi-flex gi-items-center gi-gap-2'>
          <span className={styles.mobileSubject}>{message.subject}</span>
          {message.attachmentsCount ? (
            <span className='gi-inline-flex gi-items-center gi-shrink-0 gi-text-gray-700'>
              <Icon icon='attach_file' ariaHidden />
            </span>
          ) : null}
        </div>
      </div>
    </button>
  )
}
