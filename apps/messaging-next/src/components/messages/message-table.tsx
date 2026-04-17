"use client"

import {
  Link,
  Table,
  TableBody,
  TableData,
  TableHead,
  TableHeader,
  TableRow,
} from "@ogcio/design-system-react"
import { useTranslations } from "next-intl"
import { AttachFileIcon } from "@/components/icons"
import { formatDate } from "@/util/datetime"
import { TableDataPlaceholder } from "./table-data-placeholder"

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
            <TableDataPlaceholder height={previousHeight} />
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
                {msg.attachmentsCount ? <AttachFileIcon /> : null}
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
