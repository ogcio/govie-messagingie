"use client"

import { useUrlSearchParams } from "@/hooks/use-url-search-params"
import { SubmissionDetailView } from "./submission-detail-view"
import { SubmissionListView } from "./submission-list-view"

/**
 * Submissions surface entry point. Static export means the detail view is
 * addressed by a `?id=` query param (mirroring the messages zone) rather
 * than a dynamic route segment.
 */
export function SubmissionsPage() {
  const searchParams = useUrlSearchParams()
  const selectedId = searchParams.get("id")

  if (selectedId) {
    return <SubmissionDetailView id={selectedId} />
  }

  return <SubmissionListView />
}
