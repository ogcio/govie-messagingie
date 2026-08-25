"use client"

import { Paragraph } from "@ogcio/design-system-react"
import { usePathname, useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useCallback, useMemo, useRef } from "react"
import { InboxListChromeHeader } from "@/components/messages/inbox-list-chrome-header"
import { MessagesDataTableHeader } from "@/components/messages/messages-data-table-header"
import inboxTableStyles from "@/components/messages/unified-inbox-table.module.css"
import { useUrlSearchParams } from "@/hooks/use-url-search-params"
import type { Submission } from "@/types"
import {
  computeTotalPages,
  parseSubmissionPageSize,
  SUBMISSIONS_PAGE_SIZE,
} from "./pagination-utils"
import { SubmissionListTable } from "./submission-list-table"
import styles from "./submission-list-view.module.css"
import { useSubmissionsList } from "./use-submissions"

export function SubmissionListView() {
  const t = useTranslations("submissions")
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useUrlSearchParams()
  const search = searchParams.get("search")
  const page = Number(searchParams.get("page")) || 1
  const pageSize = parseSubmissionPageSize(searchParams.get("limit"))

  const { submissions, totalCount, isLoading, error } = useSubmissionsList({
    search,
    page,
    pageSize,
  })
  const totalPages = computeTotalPages(totalCount, pageSize)

  const previousSubmissionsRef = useRef<Submission[]>([])
  const displaySubmissions = useMemo(() => {
    if (!isLoading) {
      previousSubmissionsRef.current = submissions
      return submissions
    }

    if (submissions.length > 0) {
      previousSubmissionsRef.current = submissions
      return submissions
    }

    if (previousSubmissionsRef.current.length > 0) {
      return previousSubmissionsRef.current
    }

    return submissions
  }, [submissions, isLoading])

  const handleSelect = useCallback(
    (id: string) => {
      router.push(`/${locale}/my-submissions?id=${id}`)
    },
    [locale, router],
  )

  const handlePageSizeChange = useCallback(
    (size: number) => {
      const params = new URLSearchParams(searchParams)
      if (size === SUBMISSIONS_PAGE_SIZE) {
        params.delete("limit")
      } else {
        params.set("limit", String(size))
      }
      params.delete("page")
      const qs = params.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname)
    },
    [pathname, router, searchParams],
  )

  return (
    <div className={styles.listRoot}>
      <div className={styles.inboxBleed}>
        <div className={inboxTableStyles.listChrome}>
          <InboxListChromeHeader
            searchChrome={<MessagesDataTableHeader enableFilters={false} />}
          />
          <SubmissionListTable
            submissions={displaySubmissions}
            isLoading={isLoading}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageSizeChange={handlePageSizeChange}
            onSelect={handleSelect}
          />
        </div>
        {error != null && !isLoading && (
          <Paragraph className={styles.error}>
            {t("error", { message: error.message })}
          </Paragraph>
        )}
      </div>
    </div>
  )
}
