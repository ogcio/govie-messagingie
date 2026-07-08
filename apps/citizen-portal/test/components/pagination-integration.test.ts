import { describe, expect, it } from "vitest"
import {
  buildMessagesUrl,
  computeTotalPages,
  PAGE_SIZE,
} from "@/components/messages/pagination-utils"
import { parseTab } from "@/components/messages/parse-tab"

function parseUrlParams(url: string) {
  return new URLSearchParams(url.split("?")[1])
}

function simulatePageNavigation(params: {
  tab: string
  search: string | null
  page: number
  totalCount: number
}) {
  const totalPages = computeTotalPages(params.totalCount)
  const url = buildMessagesUrl({
    tab: params.tab,
    search: params.search,
    page: params.page,
  })
  const urlParams = parseUrlParams(url)
  const offset = Number(urlParams.get("offset"))
  const limit = Number(urlParams.get("limit"))
  const isWithinBounds = offset < params.totalCount
  const isLastPage = params.page === totalPages
  return { totalPages, offset, limit, isWithinBounds, isLastPage, url }
}

describe("Pagination integration", () => {
  describe("totalPages calculation", () => {
    it("returns 0 for 0 items", () => {
      expect(computeTotalPages(0)).toBe(0)
    })

    it("returns 1 for 1 item", () => {
      expect(computeTotalPages(1)).toBe(1)
    })

    it("returns 1 for exactly PAGE_SIZE items", () => {
      expect(computeTotalPages(PAGE_SIZE)).toBe(1)
    })

    it("returns 2 for PAGE_SIZE + 1 items", () => {
      expect(computeTotalPages(PAGE_SIZE + 1)).toBe(2)
    })

    it("returns 2 for 2 * PAGE_SIZE items", () => {
      expect(computeTotalPages(2 * PAGE_SIZE)).toBe(2)
    })

    it("returns 3 for 2 * PAGE_SIZE + 1 items", () => {
      expect(computeTotalPages(2 * PAGE_SIZE + 1)).toBe(3)
    })
  })

  describe("last page offset is within bounds", () => {
    const testCases = [
      { totalCount: 1, expectedPages: 1 },
      { totalCount: PAGE_SIZE, expectedPages: 1 },
      { totalCount: PAGE_SIZE + 1, expectedPages: 2 },
      { totalCount: 2 * PAGE_SIZE, expectedPages: 2 },
      { totalCount: 2 * PAGE_SIZE + 1, expectedPages: 3 },
      { totalCount: 5 * PAGE_SIZE, expectedPages: 5 },
      { totalCount: 5 * PAGE_SIZE + 3, expectedPages: 6 },
      { totalCount: 100, expectedPages: 10 },
      { totalCount: 101, expectedPages: 11 },
    ]

    for (const { totalCount, expectedPages } of testCases) {
      it(`last page (${expectedPages}) offset < totalCount (${totalCount})`, () => {
        const result = simulatePageNavigation({
          tab: "all",
          search: null,
          page: expectedPages,
          totalCount,
        })
        expect(result.totalPages).toBe(expectedPages)
        expect(result.isLastPage).toBe(true)
        expect(result.isWithinBounds).toBe(true)
      })
    }
  })

  describe("page beyond last returns out-of-bounds offset", () => {
    it("page after last has offset >= totalCount", () => {
      const totalCount = 25
      const totalPages = computeTotalPages(totalCount)
      const result = simulatePageNavigation({
        tab: "all",
        search: null,
        page: totalPages + 1,
        totalCount,
      })
      expect(result.isWithinBounds).toBe(false)
    })
  })

  describe("every valid page has a correct offset", () => {
    it("all pages from 1 to totalPages return in-bounds offsets", () => {
      const totalCount = 35
      const totalPages = computeTotalPages(totalCount)

      for (let page = 1; page <= totalPages; page++) {
        const result = simulatePageNavigation({
          tab: "all",
          search: null,
          page,
          totalCount,
        })
        expect(result.offset).toBe((page - 1) * PAGE_SIZE)
        expect(result.isWithinBounds).toBe(true)
      }
    })
  })

  describe("pagination across tabs", () => {
    it("unread tab page 1 starts at offset 0", () => {
      const result = simulatePageNavigation({
        tab: "unread",
        search: null,
        page: 1,
        totalCount: 25,
      })
      expect(result.offset).toBe(0)
      const params = parseUrlParams(result.url)
      expect(params.get("isSeen")).toBe("false")
    })

    it("all tab page 1 starts at offset 0", () => {
      const result = simulatePageNavigation({
        tab: "all",
        search: null,
        page: 1,
        totalCount: 25,
      })
      expect(result.offset).toBe(0)
      const params = parseUrlParams(result.url)
      expect(params.has("isSeen")).toBe(false)
    })

    it("tab switch should reset to page 1 (simulated)", () => {
      const page = 1
      const unreadResult = simulatePageNavigation({
        tab: "unread",
        search: null,
        page,
        totalCount: 15,
      })
      const allResult = simulatePageNavigation({
        tab: "all",
        search: null,
        page,
        totalCount: 30,
      })
      expect(unreadResult.offset).toBe(0)
      expect(allResult.offset).toBe(0)
    })

    it("same page number produces same offset regardless of tab", () => {
      for (let page = 1; page <= 5; page++) {
        const unread = simulatePageNavigation({
          tab: "unread",
          search: null,
          page,
          totalCount: 50,
        })
        const all = simulatePageNavigation({
          tab: "all",
          search: null,
          page,
          totalCount: 50,
        })
        expect(unread.offset).toBe(all.offset)
      }
    })
  })

  describe("pagination with search filters", () => {
    it("search results page 1 starts at offset 0", () => {
      const result = simulatePageNavigation({
        tab: "all",
        search: "test query",
        page: 1,
        totalCount: 15,
      })
      expect(result.offset).toBe(0)
      const params = parseUrlParams(result.url)
      expect(params.get("search")).toBe("test query")
    })

    it("search results last page is within bounds", () => {
      const totalCount = 23
      const totalPages = computeTotalPages(totalCount)
      const result = simulatePageNavigation({
        tab: "all",
        search: "query",
        page: totalPages,
        totalCount,
      })
      expect(result.isWithinBounds).toBe(true)
      expect(result.offset).toBe((totalPages - 1) * PAGE_SIZE)
    })

    it("search + unread tab + pagination all work together", () => {
      const totalCount = 18
      const totalPages = computeTotalPages(totalCount)
      const result = simulatePageNavigation({
        tab: "unread",
        search: "important",
        page: totalPages,
        totalCount,
      })
      expect(result.isWithinBounds).toBe(true)
      const params = parseUrlParams(result.url)
      expect(params.get("isSeen")).toBe("false")
      expect(params.get("search")).toBe("important")
      expect(params.get("offset")).toBe(String((totalPages - 1) * PAGE_SIZE))
    })
  })

  describe("parseTab integration with pagination", () => {
    it("null tab defaults to unread, pagination still works", () => {
      const tab = parseTab(null)
      expect(tab).toBe("unread")
      const result = simulatePageNavigation({
        tab,
        search: null,
        page: 2,
        totalCount: 25,
      })
      expect(result.offset).toBe(PAGE_SIZE)
      const params = parseUrlParams(result.url)
      expect(params.get("isSeen")).toBe("false")
    })

    it("explicit all tab, pagination works", () => {
      const tab = parseTab("all")
      expect(tab).toBe("all")
      const result = simulatePageNavigation({
        tab,
        search: null,
        page: 3,
        totalCount: 50,
      })
      expect(result.offset).toBe(2 * PAGE_SIZE)
    })
  })

  describe("edge cases", () => {
    it("page 1 with exactly 0 results has offset 0", () => {
      const params = parseUrlParams(
        buildMessagesUrl({ tab: "all", search: null, page: 1 }),
      )
      expect(params.get("offset")).toBe("0")
    })

    it("large page numbers produce correct offsets", () => {
      const page = 100
      const params = parseUrlParams(
        buildMessagesUrl({ tab: "all", search: null, page }),
      )
      expect(params.get("offset")).toBe(String(99 * PAGE_SIZE))
    })
  })
})
