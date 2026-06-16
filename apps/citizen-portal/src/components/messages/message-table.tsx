"use client"

import {
  Icon,
  Link,
  Spinner,
  Stack,
  Table,
  TableBody,
  TableData,
  TableHead,
  TableHeader,
  TableRow,
} from "@ogcio/design-system-react"
import { useTranslations } from "next-intl"
import { formatDate } from "@/util/datetime"

interface MessageRow {
  id: string
  subject: string
  createdAt: string
  attachmentsCount?: number
}

export function MessageTable({
  messages,
  isLoading,
  previousHeight,
  onSelect,
}: {
  messages: MessageRow[]
  isLoading: boolean
  previousHeight: number
  onSelect: (id: string) => void
}) {
  const t = useTranslations("home.table")

  return (
    <Table layout='fixed' noBorder>
      <TableHead>
        <TableRow>
          <TableHeader style={{ width: "150px" }}>
            {t("column.date")}
          </TableHeader>
          <TableHeader align='left'>{t("column.details")}</TableHeader>
          <TableHeader align='right'>{t("column.attachment")}</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody id='table-body'>
        {isLoading && previousHeight > 0 ? (
          <TableRow>
            {/*
             * Loading placeholder row. Pins to the previously-rendered
             * table height so a re-fetch doesn't collapse the list and
             * shift the layout below, and centres a DS `Spinner` inside
             * a DS `Stack` — no absolute positioning, no hand-sized
             * translate hack. DS gap: `Table` / `TableData` don't have
             * a built-in loading state, so the height-pinning is left
             * as an explicit `style` hook.
             */}
            <TableData
              colSpan={3}
              align='center'
              style={{ height: `${previousHeight}px` }}
            >
              <Stack
                direction='column'
                itemsAlignment='center'
                itemsDistribution='center'
              >
                <Spinner size='xl' />
              </Stack>
            </TableData>
          </TableRow>
        ) : messages.length > 0 ? (
          messages.map((msg) => (
            <TableRow key={msg.id}>
              <TableData align='left'>
                {formatDate(msg.createdAt, "medium")}
              </TableData>
              <TableData align='left' style={{ overflowWrap: "anywhere" }}>
                <Link
                  href='#'
                  onClick={(e: React.MouseEvent) => {
                    e.preventDefault()
                    onSelect(msg.id)
                  }}
                >
                  {msg.subject}
                </Link>
              </TableData>
              <TableData align='right'>
                {msg.attachmentsCount ? (
                  <Icon icon='attach_file' ariaHidden />
                ) : null}
              </TableData>
            </TableRow>
          ))
        ) : (
          !isLoading && (
            <TableRow>
              <TableData colSpan={3}>{t("empty.unread")}</TableData>
            </TableRow>
          )
        )}
      </TableBody>
    </Table>
  )
}
