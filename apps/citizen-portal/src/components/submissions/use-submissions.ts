"use client"

import { SagFetchError } from "@ogcio/sag-client"
import { useGatewayFetch } from "@ogcio/sag-client/react"
import { useMemo } from "react"
import {
  findMockSubmissionById,
  getMockSubmissionsPage,
  getMockSubmissionsTotalCount,
} from "@/mock/submissions"
import type { Submission } from "@/types"
import {
  buildSubmissionDetailUrl,
  buildSubmissionsUrl,
  SUBMISSIONS_PAGE_SIZE,
} from "./pagination-utils"

function isNotFound(error: unknown): boolean {
  return error instanceof SagFetchError && error.status === 404
}

/**
 * Fetches a page of the user's submissions from the Journey-Builder external
 * API via the SAG gateway, falling back to bundled fixtures when mock mode is
 * on. The external list endpoint returns 404 (not an empty 200) when the user
 * has no submissions, so that status is treated as "empty", never an error.
 */
export function useSubmissionsList({
  search,
  page,
  pageSize = SUBMISSIONS_PAGE_SIZE,
  enabled = true,
}: {
  search: string | null
  page: number
  pageSize?: number
  enabled?: boolean
}): {
  submissions: Submission[]
  totalCount: number
  isLoading: boolean
  error: Error | null
} {
  const apiUrl = useMemo(
    () => (enabled ? buildSubmissionsUrl({ search, page, pageSize }) : null),
    [enabled, search, page, pageSize],
  )

  const {
    data: apiSubmissions = [],
    metadata,
    error,
    isLoading,
  } = useGatewayFetch<Submission[], { totalCount?: number }>(apiUrl)

  const submissions = useMemo(() => {
    if (apiSubmissions.length > 0) return apiSubmissions
    // Fall back to fixtures regardless of `isLoading`. The external list
    // endpoint 404s when the user has no submissions, so SWR never caches a
    // successful response and re-enters its loading state on every focus
    // revalidation; gating the fallback on `isLoading` would flash an empty
    // list each time. Consumers decide when to show a spinner (only when
    // there is genuinely nothing to display yet).
    return getMockSubmissionsPage({ search, page, pageSize })
  }, [apiSubmissions, search, page, pageSize])

  const totalCount = useMemo(() => {
    if (metadata?.totalCount) return metadata.totalCount
    return getMockSubmissionsTotalCount(search)
  }, [metadata?.totalCount, search])

  const realError = error && !isNotFound(error) ? (error as Error) : null

  return { submissions, totalCount, isLoading, error: realError }
}

/** Fetches a single submission by id, with a mock fixture fallback. */
export function useSubmission(id: string): {
  submission: Submission | null
  isLoading: boolean
  error: Error | null
} {
  const {
    data: apiData,
    error,
    isLoading,
  } = useGatewayFetch<Submission>(buildSubmissionDetailUrl(id))

  const submission = useMemo(
    () => apiData ?? findMockSubmissionById(id),
    [apiData, id],
  )

  const realError = error && !isNotFound(error) ? (error as Error) : null

  // Consumers should gate the loading spinner on `isLoading && !submission` so
  // SWR focus revalidation does not flash the whole detail view when a mock
  // or cached submission is already available.
  return { submission: submission ?? null, isLoading, error: realError }
}
