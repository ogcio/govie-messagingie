"use client"

import { FormField, Link, Paragraph } from "@ogcio/design-system-react"
import { useAuth } from "@ogcio/sag-client/react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { ListCard } from "@/components/list-card/list-card"
import { PanelLoading } from "@/components/panel-loading"
import { pickLocalized } from "@/components/submissions/localized"
import { JOURNEY_SUBMISSIONS_MIN_LIMIT } from "@/components/submissions/pagination-utils"
import { useSubmissionsList } from "@/components/submissions/use-submissions"
import { useIdleMount } from "@/hooks/use-idle-mount"
import { formatDate } from "@/util/datetime"
import { DashboardPanel } from "./dashboard-panel"
import panelStyles from "./dashboard-panel.module.css"

/** Rows shown in the dashboard preview panel. */
const RECENT_DISPLAY_LIMIT = 3

/**
 * Recent-applications preview shown on the LEA dashboard landing, alongside
 * the recent-messages panel. Each row is the shared inbox `ListCard` (reference
 * id + date header, application name as the blue preview) minus the
 * bulk-selection checkbox; tapping a card opens the submission in the same
 * zone via the client router.
 */
export function MyApplications() {
  const t = useTranslations("submissions.recent")
  const locale = useLocale()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const idleReady = useIdleMount()

  const { submissions, isLoading, error } = useSubmissionsList({
    search: null,
    page: 1,
    // Journey-Builder rejects limit=3 (min 5, multiple of 5); fetch the
    // minimum valid page and trim for the three-row preview layout.
    pageSize: JOURNEY_SUBMISSIONS_MIN_LIMIT,
    enabled: Boolean(user) && idleReady,
  })
  const recentSubmissions = submissions.slice(0, RECENT_DISPLAY_LIMIT)

  // Only block on the spinner when there's genuinely nothing to show yet;
  // keep the list visible across focus revalidations (see useSubmissionsList).
  const isWaiting =
    (authLoading || !user || isLoading) && submissions.length === 0
  const listPath = `/${locale}/my-applications`

  return (
    <DashboardPanel
      title={t("title")}
      cta={
        <Link href={listPath} asButton={{}}>
          {t("link")}
        </Link>
      }
    >
      {isWaiting ? (
        <div className={panelStyles.bodyInset}>
          <PanelLoading ariaLabel={t("loading")} />
        </div>
      ) : recentSubmissions.length ? (
        recentSubmissions.map((submission) => (
          <ListCard
            key={submission.id}
            title={submission.id}
            date={formatDate(
              submission.submittedAt ?? submission.createdAt,
              "medium",
            )}
            preview={pickLocalized(submission.title, locale)}
            previewUnderline={false}
            onClick={() => router.push(`${listPath}?id=${submission.id}`)}
          />
        ))
      ) : (
        <Paragraph className={panelStyles.bodyInset}>{t("empty")}</Paragraph>
      )}
      {error != null && !isWaiting && (
        <div className={panelStyles.bodyInset}>
          <FormField
            error={{
              text: t("error", {
                message:
                  error instanceof Error ? error.message : "Unknown error",
              }),
            }}
          />
        </div>
      )}
    </DashboardPanel>
  )
}
