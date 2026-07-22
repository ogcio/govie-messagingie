import type { Submission } from "@/types"
import { MOCK_MESSAGES_ENABLED } from "./messages"
import mockSubmissionsJson from "./submissions.json"

/**
 * Dev-only fallback fixtures for the LEA submissions surfaces, gated by the
 * same `NEXT_PUBLIC_ENABLE_MOCK_MESSAGES` flag as the inbox fixtures (see
 * `./messages.ts`). The flag defaults to `false`, so every deployed
 * environment sees empty lists / `null` detail rows until the Journey-Builder
 * API returns real data.
 *
 * Related messages on the submission detail page are fetched from
 * messaging-public-api (`GET /api/v1/citizens/messages?submissionId=...`).
 * `./related-messages.ts` remains for mock-only inbox/detail flows when mock
 * messages are enabled.
 */

const ALL_MOCKS: Submission[] = MOCK_MESSAGES_ENABLED
  ? (mockSubmissionsJson as Submission[])
  : []

function matchesSearch(submission: Submission, search: string): boolean {
  const lower = search.toLowerCase()
  return (
    submission.id.toLowerCase().includes(lower) ||
    submission.title.en.toLowerCase().includes(lower) ||
    (submission.title.ga ?? "").toLowerCase().includes(lower)
  )
}

function filterMocks(search: string | null): Submission[] {
  if (!MOCK_MESSAGES_ENABLED) return []
  if (!search) return ALL_MOCKS
  return ALL_MOCKS.filter((submission) => matchesSearch(submission, search))
}

export function getMockSubmissionsPage(params: {
  search: string | null
  page: number
  pageSize: number
}): Submission[] {
  const { search, page, pageSize } = params
  const filtered = filterMocks(search)
  return filtered.slice((page - 1) * pageSize, page * pageSize)
}

export function getMockSubmissionsTotalCount(search: string | null): number {
  return filterMocks(search).length
}

export function findMockSubmissionById(id: string): Submission | null {
  if (!MOCK_MESSAGES_ENABLED) return null
  return ALL_MOCKS.find((submission) => submission.id === id) ?? null
}

export { getMockRelatedMessages } from "./related-messages"
