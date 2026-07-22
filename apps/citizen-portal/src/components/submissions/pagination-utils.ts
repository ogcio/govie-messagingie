export const SUBMISSIONS_PAGE_SIZE = 10

/** Journey-Builder external list API: limit must be >= 5 and a multiple of 5. */
export const JOURNEY_SUBMISSIONS_MIN_LIMIT = 5

export const SUBMISSIONS_PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const

export type SubmissionsPageSize = (typeof SUBMISSIONS_PAGE_SIZE_OPTIONS)[number]

export function parseSubmissionPageSize(limitParam: string | null): number {
  const parsed = Number(limitParam)
  if (SUBMISSIONS_PAGE_SIZE_OPTIONS.includes(parsed as SubmissionsPageSize)) {
    return parsed
  }
  return SUBMISSIONS_PAGE_SIZE
}

/**
 * Builds the SAG-gateway URL for the Journey-Builder external
 * user-submissions list. Mirrors the messages `buildMessagesUrl` helper:
 * `limit`/`offset` pagination plus an optional `search` term.
 */
export function buildSubmissionsUrl(params: {
  search: string | null
  page: number
  pageSize?: number
}): string {
  const pageSize = params.pageSize ?? SUBMISSIONS_PAGE_SIZE
  const url = new URLSearchParams()
  url.set("limit", String(pageSize))
  url.set("offset", String((params.page - 1) * pageSize))
  if (params.search) {
    url.set("search", params.search)
  }
  return `/journey-builder/api/v1/external/user-submissions?${url.toString()}`
}

/** Gateway URL for a single submission by id. */
export function buildSubmissionDetailUrl(id: string): string {
  return `/journey-builder/api/v1/external/user-submissions/${id}`
}

export function computeTotalPages(
  totalCount: number,
  pageSize: number = SUBMISSIONS_PAGE_SIZE,
): number {
  return Math.ceil(totalCount / pageSize)
}
