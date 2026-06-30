import type { Message } from "@/types"
import mockMessagesJson from "./messages.json"

/**
 * Dev-only fallback fixtures for the unified inbox. Consumers should never
 * reach for the JSON directly — go through the helpers below so every
 * fallback path is gated by the same `NEXT_PUBLIC_ENABLE_MOCK_MESSAGES`
 * env flag. The flag defaults to `false`, which means callers see empty
 * lists and `null` detail rows in every deployed environment.
 *
 * Runtime validation and typing for the flag live on
 * `env.NEXT_PUBLIC_ENABLE_MOCK_MESSAGES` (see `src/env/env.client.ts`).
 * This module reads `process.env.NEXT_PUBLIC_ENABLE_MOCK_MESSAGES` directly
 * so Next.js can substitute a string literal at build time.
 *
 * Note on bundle size: Turbopack currently keeps the ~10 KB `messages.json`
 * module in the shared chunk even when the guard is a literal `false`, so
 * the fixture is still shipped in the production bundle. It is never read
 * at runtime — every helper short-circuits on `MOCK_MESSAGES_ENABLED`. If
 * stripping the fixture from the bundle becomes a concern, move the file
 * to `public/` and `fetch` it only when the flag is on.
 */

export const MOCK_MESSAGES_ENABLED: boolean =
  process.env.NEXT_PUBLIC_ENABLE_MOCK_MESSAGES === "true"

const ALL_MOCKS: Message[] = MOCK_MESSAGES_ENABLED
  ? (mockMessagesJson as Message[])
  : []

function matchesSearch(message: Message, search: string): boolean {
  const lower = search.toLowerCase()
  return (
    message.subject.toLowerCase().includes(lower) ||
    (message.threadName ?? "").toLowerCase().includes(lower)
  )
}

function filterMocks(search: string | null): Message[] {
  if (!MOCK_MESSAGES_ENABLED) return []
  if (!search) return ALL_MOCKS
  return ALL_MOCKS.filter((m) => matchesSearch(m, search))
}

export function getMockMessagesPage(params: {
  search: string | null
  page: number
  pageSize: number
}): Message[] {
  const { search, page, pageSize } = params
  const filtered = filterMocks(search)
  return filtered.slice((page - 1) * pageSize, page * pageSize)
}

export function getMockMessagesTotalCount(search: string | null): number {
  return filterMocks(search).length
}

export function findMockMessageById(id: string): Message | null {
  if (!MOCK_MESSAGES_ENABLED) return null
  return ALL_MOCKS.find((m) => m.id === id) ?? null
}

export function getMockUnreadCount(): number {
  if (!MOCK_MESSAGES_ENABLED) return 0
  return ALL_MOCKS.filter((message) => !message.isSeen).length
}
