import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const inboxPaginationCss = readFileSync(
  resolve(
    import.meta.dirname,
    "../../src/components/messages/inbox-pagination.module.css",
  ),
  "utf8",
)

describe("InboxPagination styles", () => {
  it("keeps the page select wide enough for two-digit page numbers", () => {
    expect(inboxPaginationCss).toContain(".footer :global(.gi-select)")
    expect(inboxPaginationCss).toContain("var(--gieds-space-18, 4.5rem)")
    expect(inboxPaginationCss).toContain(".footer :global(.gi-select-icon)")
  })
})
