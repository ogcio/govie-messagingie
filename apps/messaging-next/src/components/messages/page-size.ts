export const DEFAULT_PAGE_SIZE = 6

export const PAGE_SIZE_OPTIONS = [6, 10, 20, 50] as const

export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]

export function parsePageSize(limitParam: string | null): number {
  const parsed = Number(limitParam)
  if (PAGE_SIZE_OPTIONS.includes(parsed as PageSize)) {
    return parsed
  }
  return DEFAULT_PAGE_SIZE
}
